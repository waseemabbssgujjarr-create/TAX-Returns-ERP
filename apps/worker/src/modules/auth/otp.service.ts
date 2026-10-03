import { createHmac, randomInt } from 'node:crypto'

import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcrypt'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../notifications/notification.provider'
import { otpEmail } from '../notifications/templates/otp.template'

import {
  BCRYPT_OTP_COST,
  OTP_MAX_VERIFY_ATTEMPTS,
  OTP_SEND_LIMIT_PER_HOUR,
  OTP_TTL_MS,
} from './auth.constants'
import { PortalClientLookup } from './portal-client.lookup'
import { PRE_AUTH_USER_ID, withStaffBootstrapContext } from './rls-bootstrap.util'
import { TenantBootstrapService } from './tenant-bootstrap.service'
import { TokenService } from './token.service'

const OTP_SEND_RESPONSE = { message: 'A code has been sent.' } as const

const INVALID_OTP_PROBLEM = {
  type: 'https://taxdesk.pk/problems/invalid-otp',
  title: 'Invalid code.',
  status: 401,
} as const

export interface OtpSendInput {
  firmSlug: string
  contact: string
  channel: 'email' | 'sms'
}

export interface OtpVerifyInput {
  firmSlug: string
  contact: string
  code: string
}

export interface RequestMeta {
  ipAddress?: string
  userAgent?: string
}

function normaliseContact(contact: string): string {
  return contact.toLowerCase().trim()
}

function contactHmac(normalised: string): string {
  const secret = process.env['OTP_CONTACT_SECRET']
  if (!secret) {
    throw new Error('OTP_CONTACT_SECRET is required')
  }
  return createHmac('sha256', secret).update(normalised).digest('hex')
}

@Injectable()
export class OtpService {
  constructor(
    private readonly tenantBootstrap: TenantBootstrapService,
    private readonly prismaRls: PrismaRlsClient,
    private readonly tokenService: TokenService,
    private readonly portalClientLookup: PortalClientLookup,
    @Inject(NOTIFICATION_PROVIDER) private readonly notifications: NotificationProvider,
  ) {}

  async sendOtp(input: OtpSendInput, _meta: RequestMeta): Promise<{ message: string }> {
    void _meta
    const normalised = normaliseContact(input.contact)
    const hmac = contactHmac(normalised)

    const firm = await this.tenantBootstrap.resolveFirm(input.firmSlug)
    if (!firm) {
      return OTP_SEND_RESPONSE
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const sendCount = await withStaffBootstrapContext(firm.firmId, PRE_AUTH_USER_ID, () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.otpCode.count({
          where: {
            firmId: firm.firmId,
            contactHmac: hmac,
            createdAt: { gte: oneHourAgo },
          },
        }),
      ),
    )

    if (sendCount >= OTP_SEND_LIMIT_PER_HOUR) {
      throw new HttpException(
        {
          type: 'https://taxdesk.pk/problems/rate-limited',
          title: 'Too many requests',
          status: 429,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const otpHash = await bcrypt.hash(otp, BCRYPT_OTP_COST)
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

    await withStaffBootstrapContext(firm.firmId, PRE_AUTH_USER_ID, () =>
      this.prismaRls.withRlsContext(async (tx) => {
        await tx.otpCode.create({
          data: {
            firmId: firm.firmId,
            contactHmac: hmac,
            channel: input.channel,
            otpHash,
            expiresAt,
          },
        })
        await tx.auditLog.create({
          data: {
            firmId: firm.firmId,
            action: 'auth.otp.sent',
            after: { channel: input.channel, contactHmac: hmac },
          },
        })
      }),
    )

    if (input.channel === 'email') {
      const template = otpEmail(otp)
      await this.notifications.sendEmail(normalised, template.subject, template.text, template.html)
    }

    return OTP_SEND_RESPONSE
  }

  async verifyOtp(
    input: OtpVerifyInput,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; rawRefreshToken: string }> {
    const normalised = normaliseContact(input.contact)
    const hmac = contactHmac(normalised)

    const firm = await this.tenantBootstrap.resolveFirm(input.firmSlug)
    if (!firm) {
      throw new UnauthorizedException(INVALID_OTP_PROBLEM)
    }

    const now = new Date()
    const record = await withStaffBootstrapContext(firm.firmId, PRE_AUTH_USER_ID, () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.otpCode.findFirst({
          where: {
            firmId: firm.firmId,
            contactHmac: hmac,
            usedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ),
    )

    if (!record) {
      throw new UnauthorizedException(INVALID_OTP_PROBLEM)
    }

    const codeOk = await bcrypt.compare(input.code, record.otpHash)
    if (!codeOk) {
      await withStaffBootstrapContext(firm.firmId, PRE_AUTH_USER_ID, () =>
        this.prismaRls.withRlsContext(async (tx) => {
          const attempts = record.attempts + 1
          await tx.otpCode.update({
            where: { id: record.id },
            data: {
              attempts,
              usedAt: attempts >= OTP_MAX_VERIFY_ATTEMPTS ? now : record.usedAt,
            },
          })
          await tx.auditLog.create({
            data: {
              firmId: firm.firmId,
              action: 'auth.otp.fail',
              after: { contactHmac: hmac, attempts },
            },
          })
        }),
      )
      throw new UnauthorizedException(INVALID_OTP_PROBLEM)
    }

    const clientId = await this.portalClientLookup.resolveClientId(firm.firmId, hmac)
    if (!clientId) {
      throw new UnauthorizedException(INVALID_OTP_PROBLEM)
    }

    await withStaffBootstrapContext(firm.firmId, PRE_AUTH_USER_ID, () =>
      this.prismaRls.withRlsContext(async (tx) => {
        await tx.otpCode.update({
          where: { id: record.id },
          data: { usedAt: now },
        })
        await tx.auditLog.create({
          data: {
            firmId: firm.firmId,
            action: 'auth.otp.verified',
            after: { contactHmac: hmac },
          },
        })
      }),
    )

    const portalUserId = PRE_AUTH_USER_ID
    const { accessToken, jti } = this.tokenService.issueFullJwt(
      portalUserId,
      firm.firmId,
      UserRole.CLIENT,
      'portal',
      clientId,
    )
    const { rawToken } = await this.tokenService.issueRefreshToken(
      portalUserId,
      firm.firmId,
      jti,
      meta.ipAddress,
      meta.userAgent,
    )

    return { accessToken, rawRefreshToken: rawToken }
  }
}

export { contactHmac, normaliseContact, OTP_SEND_RESPONSE }
