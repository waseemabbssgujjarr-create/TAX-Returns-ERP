import { randomUUID } from 'node:crypto'

import { ConflictException, Inject, Injectable } from '@nestjs/common'
import bcrypt from 'bcrypt'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../notifications/notification.provider'
import { passwordResetEmail } from '../notifications/templates/password-reset.template'

import {
  BCRYPT_PASSWORD_COST,
  PASSWORD_RESET_COOLDOWN_MS,
  PASSWORD_RESET_TTL_MS,
} from './auth.constants'
import {
  buildVerificationTokenRaw,
  hashVerificationToken,
  normalizeEmail,
  parseVerificationTokenRaw,
} from './registration.util'
import { PRE_AUTH_USER_ID, withStaffBootstrapContext } from './rls-bootstrap.util'
import { TenantBootstrapService } from './tenant-bootstrap.service'
import { TokenService } from './token.service'

export type PasswordResetRequestResult =
  | { status: 'reset_email_sent' }
  | { status: 'reset_email_pending'; emailDeliveryFailed: true }

export type PasswordResetConfirmResult =
  | { status: 'password_updated'; firmSlug: string }
  | { status: 'invalid_token' }
  | { status: 'expired_token' }
  | { status: 'used_token' }

function appBaseUrl(): string {
  const raw = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

function resetLink(rawToken: string): string {
  return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly tenantBootstrap: TenantBootstrapService,
    private readonly tokenService: TokenService,
    @Inject(NOTIFICATION_PROVIDER) private readonly notifications: NotificationProvider,
  ) {}

  async requestReset(body: { firmSlug: string; email: string }): Promise<PasswordResetRequestResult> {
    const firm = await this.tenantBootstrap.resolveFirm(body.firmSlug)
    if (!firm) {
      return { status: 'reset_email_sent' }
    }

    const email = normalizeEmail(body.email)

    const user = await withStaffBootstrapContext(firm.firmId, PRE_AUTH_USER_ID, async () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.user.findUnique({
          where: { firmId_email: { firmId: firm.firmId, email } },
          select: {
            id: true,
            isActive: true,
            emailVerifiedAt: true,
            lastPasswordResetSentAt: true,
          },
        }),
      ),
    )

    if (!user?.isActive || !user.emailVerifiedAt) {
      return { status: 'reset_email_sent' }
    }

    if (
      user.lastPasswordResetSentAt &&
      Date.now() - user.lastPasswordResetSentAt.getTime() < PASSWORD_RESET_COOLDOWN_MS
    ) {
      throw new ConflictException({
        type: 'https://taxdesk.pk/problems/rate-limited',
        title: 'Please wait before requesting another reset email.',
        status: 429,
      })
    }

    const firmRow = await withStaffBootstrapContext(firm.firmId, user.id, async () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.firm.findUnique({ where: { id: firm.firmId }, select: { name: true, slug: true } }),
      ),
    )

    return this.issueResetEmail(
      firm.firmId,
      user.id,
      firmRow?.slug ?? body.firmSlug.toLowerCase().trim(),
      email,
      firmRow?.name ?? 'your firm',
    )
  }

  async confirmReset(rawToken: string, newPassword: string): Promise<PasswordResetConfirmResult> {
    const parsed = parseVerificationTokenRaw(rawToken.trim())
    if (!parsed) {
      return { status: 'invalid_token' }
    }

    const tokenHash = hashVerificationToken(rawToken.trim())
    const now = new Date()

    const row = await this.prismaRls.withRegistrationBootstrap(parsed.firmId, randomUUID(), (tx) =>
      tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: {
          user: { select: { email: true } },
          firm: { select: { slug: true } },
        },
      }),
    )

    if (!row || row.firmId !== parsed.firmId) {
      return { status: 'invalid_token' }
    }
    if (row.consumedAt) {
      return { status: 'used_token' }
    }
    if (row.expiresAt <= now) {
      return { status: 'expired_token' }
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_PASSWORD_COST)

    try {
      await this.prismaRls.withRegistrationBootstrap(row.firmId, row.userId, async (tx) => {
        const updated = await tx.passwordResetToken.updateMany({
          where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        })
        if (updated.count !== 1) {
          throw new Error('token_race')
        }

        await tx.user.update({
          where: { id: row.userId },
          data: {
            passwordHash,
            passwordChangedAt: now,
            failedLoginCount: 0,
            lockedUntil: null,
            lastPasswordResetSentAt: null,
          },
        })

        await tx.auditLog.create({
          data: {
            firmId: row.firmId,
            userId: row.userId,
            action: 'auth.password_reset',
            after: { email: row.user.email },
          },
        })
      })
    } catch {
      return { status: 'used_token' }
    }

    await this.tokenService.revokeAllRefreshTokens(row.userId, row.firmId)

    return { status: 'password_updated', firmSlug: row.firm.slug }
  }

  private async issueResetEmail(
    firmId: string,
    userId: string,
    _firmSlug: string,
    email: string,
    firmName: string,
  ): Promise<PasswordResetRequestResult> {
    const rawToken = buildVerificationTokenRaw(firmId)
    const tokenHash = hashVerificationToken(rawToken)
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS)
    const sentAt = new Date()

    await withStaffBootstrapContext(firmId, userId, async () =>
      this.prismaRls.withRlsContext(async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: { firmId, userId, consumedAt: null },
          data: { consumedAt: sentAt },
        })

        await tx.passwordResetToken.create({
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
          data: { lastPasswordResetSentAt: sentAt },
        })
      }),
    )

    const minutes = Math.round(PASSWORD_RESET_TTL_MS / (60 * 1000))
    const template = passwordResetEmail({
      firmName,
      resetUrl: resetLink(rawToken),
      expiresMinutes: minutes,
    })

    try {
      await this.notifications.sendEmail(email, template.subject, template.text, template.html)
    } catch {
      return { status: 'reset_email_pending', emailDeliveryFailed: true }
    }

    return { status: 'reset_email_sent' }
  }
}
