import { Injectable, UnauthorizedException } from '@nestjs/common'

import { PrismaRlsClient } from '../../database/prisma-rls.client'

import type { JwtPayload, RequestMeta } from './auth.types'
import { withStaffBootstrapContext } from './rls-bootstrap.util'
import { TokenService } from './token.service'
import { TotpService } from './totp.service'

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly totpService: TotpService,
    private readonly tokenService: TokenService,
    private readonly prismaRls: PrismaRlsClient,
  ) {}

  async verifyTotpAndIssueSession(
    partialPayload: JwtPayload,
    body: { code?: string; recoveryCode?: string },
    meta: RequestMeta,
  ): Promise<{ accessToken: string; rawRefreshToken: string }> {
    if (partialPayload.sessionState !== 'partial') {
      throw new UnauthorizedException({
        type: 'https://taxdesk.pk/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
      })
    }

    const userId = partialPayload.sub
    const firmId = partialPayload.firmId

    let ok = false
    if (body.code) {
      ok = await this.totpService.verifyTotp(userId, firmId, body.code)
    } else if (body.recoveryCode) {
      ok = await this.totpService.verifyRecoveryCode(userId, firmId, body.recoveryCode)
    }

    if (!ok) {
      throw new UnauthorizedException({
        type: 'https://taxdesk.pk/problems/unauthorized',
        title: 'Invalid code.',
        status: 401,
      })
    }

    return this.issueFullStaffSession(userId, firmId, meta)
  }

  async issueFullStaffSession(
    userId: string,
    firmId: string,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; rawRefreshToken: string }> {
    const user = await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) => {
        const row = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })
        if (!row) {
          return null
        }

        await tx.user.update({
          where: { id: userId },
          data: { lastLoginAt: new Date(), totpVerifiedAt: new Date(), lastActivityAt: new Date() },
        })

        await tx.auditLog.create({
          data: {
            firmId,
            userId,
            action: 'auth.login.success',
            ipAddress: meta.ipAddress ?? null,
            userAgent: meta.userAgent ?? null,
            after: { ipAddress: meta.ipAddress ?? null, userAgent: meta.userAgent ?? null },
          },
        })

        return row
      }),
    )

    if (!user) {
      throw new UnauthorizedException({
        type: 'https://taxdesk.pk/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
      })
    }

    const { accessToken, jti } = this.tokenService.issueFullJwt(userId, firmId, user.role, 'staff')
    const { rawToken } = await this.tokenService.issueRefreshToken(
      userId,
      firmId,
      jti,
      meta.ipAddress,
      meta.userAgent,
    )

    return { accessToken, rawRefreshToken: rawToken }
  }
}
