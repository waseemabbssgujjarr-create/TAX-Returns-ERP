import { JwtService } from '@nestjs/jwt'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuditService } from '../audit/audit.service'

import { InvalidRefreshTokenError, ReplayAttackError } from './auth.errors'
import {
  TokenService,
  hashRefreshToken,
  parseRefreshTokenRaw,
  buildRefreshTokenRaw,
} from './token.service'

describe('TokenService', () => {
  let service: TokenService
  let jwtService: JwtService
  let prismaRls: PrismaRlsClient
  let audit: AuditService
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let withPreAuthFirmContextMock: ReturnType<typeof vi.fn>
  let auditLogMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(48)
    process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(48)

    jwtService = new JwtService({ secret: process.env['JWT_ACCESS_SECRET'] })
    auditLogMock = vi.fn()
    audit = { log: auditLogMock } as unknown as AuditService

    withRlsContextMock = vi.fn()
    withPreAuthFirmContextMock = vi.fn()

    prismaRls = {
      withRlsContext: withRlsContextMock,
      withPreAuthFirmContext: withPreAuthFirmContextMock,
    } as unknown as PrismaRlsClient

    service = new TokenService(jwtService, prismaRls, audit)
  })

  it('stores only SHA-256 hash — raw token differs from tokenHash', async () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const userId = '22222222-2222-2222-2222-222222222222'
    let capturedHash = ''

    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        refreshToken: {
          create: vi.fn(({ data }: { data: { tokenHash: string } }) => {
            capturedHash = data.tokenHash
            return Promise.resolve({ id: 'rt-1' })
          }),
        },
      }
      return fn(tx as never)
    })

    const { rawToken } = await service.issueRefreshToken(userId, firmId, 'family-1')
    expect(capturedHash).toBe(hashRefreshToken(rawToken))
    expect(capturedHash).not.toBe(rawToken)
  })

  it('normal rotation revokes old token and inserts new', async () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const userId = '22222222-2222-2222-2222-222222222222'
    const raw = buildRefreshTokenRaw(firmId)
    const tokenHash = hashRefreshToken(raw)
    const existing = {
      id: 'old',
      firmId,
      userId,
      tokenHash,
      jwtFamily: 'fam',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    }

    const update = vi.fn()
    const create = vi.fn()
    const findUnique = vi.fn().mockResolvedValue(existing)
    const userFind = vi
      .fn()
      .mockResolvedValue({ isActive: true, role: 'OWNER', lastActivityAt: new Date() })
    const firmFind = vi.fn().mockResolvedValue({ idleTimeoutMinutes: 0 })

    withPreAuthFirmContextMock.mockImplementation(
      (_firm: string, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn(),
          refreshToken: { findUnique, update, create },
          user: { findUnique: userFind },
          firm: { findUnique: firmFind },
          auditLog: { create: vi.fn() },
        }
        return fn(tx as never)
      },
    )

    const result = await service.rotateRefreshToken(raw)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'old' },
      data: { revokedAt: expect.any(Date) as Date },
    })
    expect(create).toHaveBeenCalled()
    expect(result.accessToken).toBeTruthy()
    expect(result.rawToken).not.toBe(raw)
  })

  it('replay detection revokes entire jwtFamily', async () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const raw = buildRefreshTokenRaw(firmId)
    const tokenHash = hashRefreshToken(raw)
    const updateMany = vi.fn()

    withPreAuthFirmContextMock.mockImplementation(
      (_firm: string, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn(),
          refreshToken: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'x',
              firmId,
              userId: 'u',
              tokenHash,
              jwtFamily: 'fam-replay',
              expiresAt: new Date(Date.now() + 60_000),
              revokedAt: new Date(),
            }),
            updateMany,
          },
        }
        return fn(tx as never)
      },
    )

    await expect(service.rotateRefreshToken(raw)).rejects.toBeInstanceOf(ReplayAttackError)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jwtFamily: 'fam-replay', firmId, revokedAt: null },
      }),
    )
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.anomaly.replay_detected' }),
    )
  })

  it('rejects expired token', async () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const raw = buildRefreshTokenRaw(firmId)

    withPreAuthFirmContextMock.mockImplementation(
      (_firm: string, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn(),
          refreshToken: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'x',
              firmId,
              userId: 'u',
              tokenHash: hashRefreshToken(raw),
              jwtFamily: 'f',
              expiresAt: new Date(Date.now() - 1),
              revokedAt: null,
            }),
          },
        }
        return fn(tx as never)
      },
    )

    await expect(service.rotateRefreshToken(raw)).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })

  it('rejects revoked token without issuing new token', async () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const raw = buildRefreshTokenRaw(firmId)
    const create = vi.fn()

    withPreAuthFirmContextMock.mockImplementation(
      (_firm: string, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn(),
          refreshToken: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'x',
              firmId,
              userId: 'u',
              tokenHash: hashRefreshToken(raw),
              jwtFamily: 'f',
              expiresAt: new Date(Date.now() + 60_000),
              revokedAt: new Date(),
            }),
            updateMany: vi.fn(),
            create,
          },
        }
        return fn(tx as never)
      },
    )

    await expect(service.rotateRefreshToken(raw)).rejects.toBeInstanceOf(ReplayAttackError)
    expect(create).not.toHaveBeenCalled()
  })

  it('parseRefreshTokenRaw requires firmId and 32-byte hex secret', () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const valid = parseRefreshTokenRaw(buildRefreshTokenRaw(firmId))
    expect(valid?.firmId).toBe(firmId)
    expect(parseRefreshTokenRaw('bad')).toBeNull()
  })

  it('concurrent refresh: second call hits replay after first revokes', async () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const raw = buildRefreshTokenRaw(firmId)
    let revoked = false

    withPreAuthFirmContextMock.mockImplementation(
      (_firm: string, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn(),
          refreshToken: {
            findUnique: vi.fn().mockImplementation(() =>
              Promise.resolve({
                id: 'x',
                firmId,
                userId: 'u',
                tokenHash: hashRefreshToken(raw),
                jwtFamily: 'fam',
                expiresAt: new Date(Date.now() + 60_000),
                revokedAt: revoked ? new Date() : null,
              }),
            ),
            update: vi.fn().mockImplementation(() => {
              revoked = true
              return Promise.resolve(undefined)
            }),
            create: vi.fn(),
            updateMany: vi.fn(),
          },
          user: {
            findUnique: vi
              .fn()
              .mockResolvedValue({ isActive: true, role: 'OWNER', lastActivityAt: new Date() }),
          },
          firm: { findUnique: vi.fn().mockResolvedValue({ idleTimeoutMinutes: 0 }) },
          auditLog: { create: vi.fn() },
        }
        return fn(tx as never)
      },
    )

    await service.rotateRefreshToken(raw)
    await expect(service.rotateRefreshToken(raw)).rejects.toBeInstanceOf(ReplayAttackError)
  })
})
