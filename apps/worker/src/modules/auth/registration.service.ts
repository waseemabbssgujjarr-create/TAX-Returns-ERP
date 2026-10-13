import { randomUUID } from 'node:crypto'

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcrypt'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { KMS_TOKEN, type KeyManagementService } from '../kms/kms.interface'
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../notifications/notification.provider'
import { emailVerificationEmail } from '../notifications/templates/email-verification.template'

import {
  BCRYPT_PASSWORD_COST,
  REGISTRATION_RESEND_COOLDOWN_MS,
  REGISTRATION_VERIFICATION_TTL_MS,
} from './auth.constants'
import {
  buildVerificationTokenRaw,
  hashVerificationToken,
  normalizeEmail,
  parseVerificationTokenRaw,
  slugifyFirmName,
} from './registration.util'
import { TenantBootstrapService } from './tenant-bootstrap.service'

export interface RegisterDto {
  firmName: string
  contactName: string
  email: string
  password: string
  phone: string
  city: string
  firmSize: string
  notes?: string | undefined
}

export type RegisterResult =
  | { status: 'verification_sent'; firmSlug: string }
  | { status: 'verification_pending'; firmSlug: string; emailDeliveryFailed: true }

export type VerifyEmailResult =
  | { status: 'verified'; firmSlug: string }
  | { status: 'already_verified'; firmSlug: string }
  | { status: 'invalid_token' }
  | { status: 'expired_token' }
  | { status: 'used_token' }

function appBaseUrl(): string {
  const raw = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

function verificationLink(rawToken: string): string {
  return `${appBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly tenantBootstrap: TenantBootstrapService,
    @Inject(KMS_TOKEN) private readonly kms: KeyManagementService,
    @Inject(NOTIFICATION_PROVIDER) private readonly notifications: NotificationProvider,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const email = normalizeEmail(dto.email)
    const slug = slugifyFirmName(dto.firmName)

    const existingFirm = await this.tenantBootstrap.resolveFirm(slug, { includeInactive: true })
    if (existingFirm) {
      const duplicate = await this.findUserByEmailInFirm(existingFirm.firmId, email)
      if (duplicate?.emailVerifiedAt) {
        throw new ConflictException({
          type: 'https://taxdesk.pk/problems/conflict',
          title: 'Registration could not be completed.',
          status: 409,
        })
      }
      if (duplicate) {
        return this.resendVerificationForUser(existingFirm.firmId, duplicate.id, slug)
      }
      throw new ConflictException({
        type: 'https://taxdesk.pk/problems/conflict',
        title: 'Registration could not be completed.',
        status: 409,
      })
    }

    const firmId = randomUUID()
    const userId = randomUUID()
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_PASSWORD_COST)
    const { plaintext, wrapped } = await this.kms.generateDataKey()
    plaintext.fill(0)

    await this.prismaRls.withRegistrationBootstrap(firmId, userId, async (tx) => {
      await tx.firm.create({
        data: {
          id: firmId,
          name: dto.firmName.trim(),
          slug,
          isActive: false,
          encryptedDataKey: wrapped,
        },
      })

      await tx.user.create({
        data: {
          id: userId,
          firmId,
          email,
          passwordHash,
          name: dto.contactName.trim(),
          role: UserRole.OWNER,
          phoneNumber: dto.phone.trim(),
          isActive: false,
          emailVerifiedAt: null,
          totpEnabled: false,
        },
      })

      await tx.auditLog.create({
        data: {
          firmId,
          userId,
          action: 'auth.register',
          after: {
            email,
            city: dto.city.trim(),
            firmSize: dto.firmSize,
            ...(dto.notes?.trim() ? { notes: dto.notes.trim() } : {}),
          },
        },
      })
    })

    return this.issueVerificationEmail(firmId, userId, slug, email, dto.firmName.trim())
  }

  async resendVerification(body: { firmSlug: string; email: string }): Promise<RegisterResult> {
    const firm = await this.tenantBootstrap.resolveFirm(body.firmSlug, { includeInactive: true })
    if (!firm) {
      throw new BadRequestException({
        type: 'https://taxdesk.pk/problems/bad-request',
        title: 'Unable to resend verification email.',
        status: 400,
      })
    }

    const email = normalizeEmail(body.email)
    const user = await this.findUserByEmailInFirm(firm.firmId, email)
    if (!user || user.emailVerifiedAt) {
      return { status: 'verification_sent', firmSlug: body.firmSlug.toLowerCase().trim() }
    }

    if (
      user.lastVerificationSentAt &&
      Date.now() - user.lastVerificationSentAt.getTime() < REGISTRATION_RESEND_COOLDOWN_MS
    ) {
      throw new ConflictException({
        type: 'https://taxdesk.pk/problems/rate-limited',
        title: 'Please wait before requesting another verification email.',
        status: 429,
      })
    }

    const firmRow = await this.prismaRls.withRegistrationBootstrap(firm.firmId, user.id, (tx) =>
      tx.firm.findUnique({ where: { id: firm.firmId }, select: { name: true, slug: true } }),
    )

    const slug = firmRow?.slug ?? body.firmSlug
    const firmName = firmRow?.name ?? 'your firm'
    return this.issueVerificationEmail(firm.firmId, user.id, slug, email, firmName)
  }

  async verifyEmail(rawToken: string): Promise<VerifyEmailResult> {
    const parsed = parseVerificationTokenRaw(rawToken.trim())
    if (!parsed) {
      return { status: 'invalid_token' }
    }

    const tokenHash = hashVerificationToken(rawToken.trim())
    const now = new Date()

    const row = await this.prismaRls.withRegistrationBootstrap(parsed.firmId, randomUUID(), (tx) =>
      tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        include: {
          user: { select: { emailVerifiedAt: true, email: true } },
          firm: { select: { slug: true } },
        },
      }),
    )

    if (!row || row.firmId !== parsed.firmId) {
      return { status: 'invalid_token' }
    }
    if (row.user.emailVerifiedAt) {
      return { status: 'already_verified', firmSlug: row.firm.slug }
    }
    if (row.consumedAt) {
      return { status: 'used_token' }
    }
    if (row.expiresAt <= now) {
      return { status: 'expired_token' }
    }

    try {
      await this.prismaRls.withRegistrationBootstrap(row.firmId, row.userId, async (tx) => {
        const updated = await tx.emailVerificationToken.updateMany({
          where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        })
        if (updated.count !== 1) {
          throw new Error('token_race')
        }

        await tx.user.update({
          where: { id: row.userId },
          data: { emailVerifiedAt: now, isActive: true, lastVerificationSentAt: null },
        })

        await tx.firm.update({
          where: { id: row.firmId },
          data: { isActive: true },
        })

        await tx.auditLog.create({
          data: {
            firmId: row.firmId,
            userId: row.userId,
            action: 'auth.email_verified',
            after: { email: row.user.email },
          },
        })
      })
    } catch {
      return { status: 'used_token' }
    }

    return { status: 'verified', firmSlug: row.firm.slug }
  }

  private async findUserByEmailInFirm(firmId: string, email: string) {
    return this.prismaRls.withRegistrationBootstrap(firmId, randomUUID(), (tx) =>
      tx.user.findUnique({
        where: { firmId_email: { firmId, email } },
        select: {
          id: true,
          emailVerifiedAt: true,
          lastVerificationSentAt: true,
        },
      }),
    )
  }

  private async resendVerificationForUser(
    firmId: string,
    userId: string,
    firmSlug: string,
  ): Promise<RegisterResult> {
    const firmRow = await this.prismaRls.withRegistrationBootstrap(firmId, userId, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, lastVerificationSentAt: true },
      })
      const firm = await tx.firm.findUnique({ where: { id: firmId }, select: { name: true } })
      return { user, firm }
    })

    if (!firmRow.user) {
      throw new ConflictException()
    }

    if (
      firmRow.user.lastVerificationSentAt &&
      Date.now() - firmRow.user.lastVerificationSentAt.getTime() < REGISTRATION_RESEND_COOLDOWN_MS
    ) {
      return { status: 'verification_sent', firmSlug }
    }

    return this.issueVerificationEmail(
      firmId,
      userId,
      firmSlug,
      firmRow.user.email,
      firmRow.firm?.name ?? 'your firm',
    )
  }

  private async issueVerificationEmail(
    firmId: string,
    userId: string,
    firmSlug: string,
    email: string,
    firmName: string,
  ): Promise<RegisterResult> {
    const rawToken = buildVerificationTokenRaw(firmId)
    const tokenHash = hashVerificationToken(rawToken)
    const expiresAt = new Date(Date.now() + REGISTRATION_VERIFICATION_TTL_MS)
    const sentAt = new Date()

    await this.prismaRls.withRegistrationBootstrap(firmId, userId, async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: { firmId, userId, consumedAt: null },
        data: { consumedAt: sentAt },
      })

      await tx.emailVerificationToken.create({
        data: {
          id: randomUUID(),
          firmId,
          userId,
          tokenHash,
          expiresAt,
        },
      })

      await tx.user.update({
        where: { id: userId },
        data: { lastVerificationSentAt: sentAt },
      })
    })

    const hours = Math.round(REGISTRATION_VERIFICATION_TTL_MS / (60 * 60 * 1000))
    const template = emailVerificationEmail({
      firmName,
      verifyUrl: verificationLink(rawToken),
      expiresHours: hours,
    })

    try {
      await this.notifications.sendEmail(email, template.subject, template.text, template.html)
    } catch {
      return { status: 'verification_pending', firmSlug, emailDeliveryFailed: true }
    }

    return { status: 'verification_sent', firmSlug }
  }
}
