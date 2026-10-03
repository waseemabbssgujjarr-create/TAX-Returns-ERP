import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcrypt'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../notifications/notification.provider'
import { accountLockedEmail } from '../notifications/templates/account-locked.template'

import {
  DUMMY_PASSWORD_HASH,
  INVALID_CREDENTIALS_MESSAGE,
  LOCK_DURATION_MS,
  MAX_PASSWORD_FAILURES,
  UNKNOWN_FIRM_DELAY_MS,
} from './auth.constants'
import type { RequestMeta } from './auth.types'
import { withStaffBootstrapContext, PRE_AUTH_USER_ID } from './rls-bootstrap.util'
import { TenantBootstrapService } from './tenant-bootstrap.service'
import { TokenService } from './token.service'

export interface LoginDto {
  firmSlug: string
  email: string
  password: string
}

export type LoginResult =
  | { accessToken: string; requiresTotpSetup: true }
  | { accessToken: string; requiresTotp: true }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

@Injectable()
export class AuthService {
  constructor(
    private readonly tenantBootstrap: TenantBootstrapService,
    private readonly prismaRls: PrismaRlsClient,
    private readonly tokenService: TokenService,
    @Inject(NOTIFICATION_PROVIDER) private readonly notifications: NotificationProvider,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    const firm = await this.tenantBootstrap.resolveFirm(dto.firmSlug)
    if (!firm) {
      await sleep(UNKNOWN_FIRM_DELAY_MS)
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH)
      throw this.invalidCredentials()
    }

    const email = dto.email.toLowerCase().trim()

    return withStaffBootstrapContext(firm.firmId, PRE_AUTH_USER_ID, async () => {
      const user = await this.prismaRls.withRlsContext(async (tx) =>
        tx.user.findUnique({
          where: { firmId_email: { firmId: firm.firmId, email } },
        }),
      )

      if (!user) {
        await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH)
        throw this.invalidCredentials()
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw this.invalidCredentials()
      }

      const passwordOk = await bcrypt.compare(dto.password, user.passwordHash)
      if (!passwordOk) {
        const failure = await this.prismaRls.withRlsContext(async (tx) => {
          const failedLoginCount = user.failedLoginCount + 1
          const lockedUntil =
            failedLoginCount >= MAX_PASSWORD_FAILURES
              ? new Date(Date.now() + LOCK_DURATION_MS)
              : null

          await tx.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount,
              lockedUntil,
            },
          })

          await tx.auditLog.create({
            data: {
              firmId: firm.firmId,
              userId: user.id,
              action: 'auth.login.password_fail',
              ipAddress: meta.ipAddress ?? null,
              userAgent: meta.userAgent ?? null,
              after: { email, ipAddress: meta.ipAddress ?? null },
            },
          })

          let firmName: string | null = null
          if (lockedUntil) {
            await tx.auditLog.create({
              data: {
                firmId: firm.firmId,
                userId: user.id,
                action: 'auth.login.account_locked',
                after: { lockedUntil: lockedUntil.toISOString() },
              },
            })
            const firmRow = await tx.firm.findUnique({
              where: { id: firm.firmId },
              select: { name: true },
            })
            firmName = firmRow?.name ?? null
          }

          return { lockedUntil, failedLoginCount, firmName }
        })

        // Email is sent AFTER the transaction closes — never hold a DB connection for SMTP.
        if (failure.lockedUntil) {
          const template = accountLockedEmail(failure.firmName ?? 'your firm', new Date())
          void Promise.resolve(
            this.notifications.sendEmail(
              user.email,
              template.subject,
              template.text,
              template.html,
            ),
          ).catch(() => undefined)
        }

        throw this.invalidCredentials()
      }

      await this.prismaRls.withRlsContext(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null },
        })
      })

      const { accessToken } = this.tokenService.issuePartialJwt(
        user.id,
        firm.firmId,
        user.role,
        'staff',
      )

      if (!user.totpEnabled) {
        return { accessToken, requiresTotpSetup: true }
      }
      return { accessToken, requiresTotp: true }
    })
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      type: 'https://taxdesk.pk/problems/unauthorized',
      title: INVALID_CREDENTIALS_MESSAGE,
      status: 401,
    })
  }
}
