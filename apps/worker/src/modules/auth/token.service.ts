import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { Injectable, OnModuleInit } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { UserRole } from '@prisma/client'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'

import { REFRESH_TOKEN_TTL_DAYS } from './auth.constants'
import { InvalidRefreshTokenError, ReplayAttackError } from './auth.errors'
import type { JwtPayload, SessionState, SessionType } from './auth.types'
import { withStaffBootstrapContext } from './rls-bootstrap.util'

type RlsTx = Parameters<Parameters<PrismaRlsClient['withRlsContext']>[0]>[0]

function assertJwtSecrets(): void {
  if (!process.env['JWT_ACCESS_SECRET']?.length) {
    throw new Error('JWT_ACCESS_SECRET is required')
  }
  if (!process.env['JWT_REFRESH_SECRET']?.length) {
    throw new Error('JWT_REFRESH_SECRET is required')
  }
}

function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function parseRefreshTokenRaw(raw: string): { firmId: string } | null {
  const dot = raw.indexOf('.')
  if (dot <= 0) {
    return null
  }
  const firmId = raw.slice(0, dot)
  const secretHex = raw.slice(dot + 1)
  if (secretHex.length !== 64 || !/^[a-f0-9]+$/.test(secretHex)) {
    return null
  }
  return { firmId }
}

function buildRefreshTokenRaw(firmId: string): string {
  return `${firmId}.${randomBytes(32).toString('hex')}`
}

@Injectable()
export class TokenService implements OnModuleInit {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    assertJwtSecrets()
  }

  issuePartialJwt(
    userId: string,
    firmId: string,
    role: UserRole,
    sessionType: SessionType,
  ): { accessToken: string; jti: string } {
    const jti = randomUUID()
    const accessToken = this.jwtService.sign(
      {
        firmId,
        role,
        sessionState: 'partial' satisfies SessionState,
        sessionType,
      },
      { subject: userId, jwtid: jti },
    )
    return { accessToken, jti }
  }

  issueFullJwt(
    userId: string,
    firmId: string,
    role: UserRole,
    sessionType: SessionType,
    clientId?: string,
  ): { accessToken: string; jti: string } {
    const jti = randomUUID()
    const payload: Record<string, unknown> = {
      firmId,
      role,
      sessionState: 'full' satisfies SessionState,
      sessionType,
    }
    if (clientId) {
      payload['clientId'] = clientId
    }
    const accessToken = this.jwtService.sign(payload, { subject: userId, jwtid: jti })
    return { accessToken, jti }
  }

  async issueRefreshToken(
    userId: string,
    firmId: string,
    jwtFamily: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ rawToken: string; recordId: string }> {
    const rawToken = buildRefreshTokenRaw(firmId)
    const tokenHash = hashRefreshToken(rawToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)

    const record = await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.refreshToken.create({
          data: {
            firmId,
            userId,
            tokenHash,
            jwtFamily,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            expiresAt,
          },
        }),
      ),
    )

    return { rawToken, recordId: record.id }
  }

  async rotateRefreshToken(
    rawToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ rawToken: string; accessToken: string; userId: string; firmId: string }> {
    const parsed = parseRefreshTokenRaw(rawToken)
    if (!parsed) {
      throw new InvalidRefreshTokenError()
    }

    const tokenHash = hashRefreshToken(rawToken)
    const now = new Date()

    const outcome = await this.prismaRls.withPreAuthFirmContext(parsed.firmId, async (tx) => {
      /*
       * Concurrent refresh: pg_advisory_xact_lock serialises rotation per token hash.
       * First caller revokes and inserts; second sees revokedAt set → replay path unless
       * the lock prevented a spurious family revoke (losing tab should refresh with new cookie).
       */
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tokenHash}))`

      const existing = await tx.refreshToken.findUnique({ where: { tokenHash } })
      if (!existing) {
        throw new InvalidRefreshTokenError()
      }

      if (existing.expiresAt <= now) {
        throw new InvalidRefreshTokenError()
      }

      if (existing.revokedAt) {
        // Commit family revoke inside this transaction, then signal replay after commit.
        // Throwing ReplayAttackError here would roll back the revoke.
        await this.revokeJwtFamilyInTx(tx, existing.jwtFamily, existing.firmId)
        return {
          kind: 'replay' as const,
          firmId: existing.firmId,
          userId: existing.userId,
          jwtFamily: existing.jwtFamily,
        }
      }

      const user = await tx.user.findUnique({
        where: { id: existing.userId },
        select: { isActive: true, role: true, lastActivityAt: true },
      })
      if (!user?.isActive) {
        throw new InvalidRefreshTokenError()
      }

      const firm = await tx.firm.findUnique({
        where: { id: existing.firmId },
        select: { idleTimeoutMinutes: true },
      })
      const idleMinutes = firm?.idleTimeoutMinutes ?? 0
      const effectiveIdle = idleMinutes > 0 ? idleMinutes : 30
      if (user.lastActivityAt) {
        const idleMs = effectiveIdle * 60 * 1000
        if (now.getTime() - user.lastActivityAt.getTime() > idleMs) {
          await tx.refreshToken.update({
            where: { id: existing.id },
            data: { revokedAt: now },
          })
          // Return after commit — throwing would roll back the idle revoke
          return {
            kind: 'idle' as const,
          }
        }
      }

      const newRaw = buildRefreshTokenRaw(existing.firmId)
      const newHash = hashRefreshToken(newRaw)
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: now },
      })

      await tx.refreshToken.create({
        data: {
          firmId: existing.firmId,
          userId: existing.userId,
          tokenHash: newHash,
          jwtFamily: existing.jwtFamily,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          expiresAt,
        },
      })

      await tx.auditLog.create({
        data: {
          firmId: existing.firmId,
          userId: existing.userId,
          action: 'auth.session.refresh',
          after: { ipAddress: ipAddress ?? null },
        },
      })

      const { accessToken } = this.issueFullJwt(
        existing.userId,
        existing.firmId,
        user.role,
        'staff',
      )

      return {
        kind: 'ok' as const,
        rawToken: newRaw,
        accessToken,
        userId: existing.userId,
        firmId: existing.firmId,
      }
    })

    if (outcome.kind === 'replay') {
      await withStaffBootstrapContext(outcome.firmId, outcome.userId, () =>
        this.audit.log({
          action: 'auth.anomaly.replay_detected',
          firmId: outcome.firmId,
          userId: outcome.userId,
          payload: { jwtFamily: outcome.jwtFamily },
        }),
      )
      throw new ReplayAttackError()
    }

    if (outcome.kind === 'idle') {
      throw new InvalidRefreshTokenError()
    }

    return {
      rawToken: outcome.rawToken,
      accessToken: outcome.accessToken,
      userId: outcome.userId,
      firmId: outcome.firmId,
    }
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const parsed = parseRefreshTokenRaw(rawToken)
    if (!parsed) {
      return
    }
    const tokenHash = hashRefreshToken(rawToken)
    const now = new Date()

    await this.prismaRls.withPreAuthFirmContext(parsed.firmId, async (tx) => {
      await tx.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now },
      })
    })
  }

  async revokeAllRefreshTokens(userId: string, firmId: string): Promise<void> {
    const now = new Date()
    await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) => {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        })
      }),
    )
  }

  private async revokeJwtFamilyInTx(tx: RlsTx, jwtFamily: string, firmId: string): Promise<void> {
    const now = new Date()
    await tx.refreshToken.updateMany({
      where: { jwtFamily, firmId, revokedAt: null },
      data: { revokedAt: now },
    })
  }

  verifyPayload(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, { algorithms: ['HS256'] })
  }
}

export { hashRefreshToken, buildRefreshTokenRaw }
