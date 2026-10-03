import { UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcrypt'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { NotificationProvider } from '../notifications/notification.provider'

import { BCRYPT_PASSWORD_COST, INVALID_CREDENTIALS_MESSAGE } from './auth.constants'
import { AuthService } from './auth.service'
import type { TenantBootstrapService } from './tenant-bootstrap.service'
import type { TokenService } from './token.service'

describe('AuthService.login', () => {
  let service: AuthService
  let tenantBootstrap: TenantBootstrapService
  let prismaRls: PrismaRlsClient
  let tokenService: TokenService
  let notifications: NotificationProvider
  let resolveFirmMock: ReturnType<typeof vi.fn>
  let withRlsContextMock: ReturnType<typeof vi.fn>

  const meta = { ipAddress: '127.0.0.1', userAgent: 'vitest' }
  const firmId = '11111111-1111-1111-1111-111111111111'

  beforeEach(() => {
    resolveFirmMock = vi.fn()
    withRlsContextMock = vi.fn()

    tenantBootstrap = {
      resolveFirm: resolveFirmMock,
    } as unknown as TenantBootstrapService

    prismaRls = {
      withRlsContext: withRlsContextMock,
    } as unknown as PrismaRlsClient

    tokenService = {
      issuePartialJwt: vi.fn().mockReturnValue({ accessToken: 'partial-token', jti: 'jti' }),
    } as unknown as TokenService

    notifications = {
      sendEmail: vi.fn(),
      sendSms: vi.fn(),
    }

    service = new AuthService(tenantBootstrap, prismaRls, tokenService, notifications)
  })

  async function expectInvalidCredentials(promise: Promise<unknown>) {
    try {
      await promise
      throw new Error('expected rejection')
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException)
      const response = (err as UnauthorizedException).getResponse() as { title: string }
      expect(response.title).toBe(INVALID_CREDENTIALS_MESSAGE)
    }
  }

  it('returns generic 401 for unknown firm', async () => {
    resolveFirmMock.mockResolvedValue(null)
    await expectInvalidCredentials(
      service.login({ firmSlug: 'missing', email: 'a@b.com', password: 'x' }, meta),
    )
  })

  it('returns generic 401 for unknown user and runs bcrypt compare', async () => {
    resolveFirmMock.mockResolvedValue({ firmId, idleTimeoutMinutes: 0 })
    withRlsContextMock.mockResolvedValue(null)
    const compareSpy = vi.spyOn(bcrypt, 'compare')

    await expectInvalidCredentials(
      service.login({ firmSlug: 'firm', email: 'a@b.com', password: 'x' }, meta),
    )
    expect(compareSpy).toHaveBeenCalled()
  })

  it('returns generic 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct', BCRYPT_PASSWORD_COST)
    resolveFirmMock.mockResolvedValue({ firmId, idleTimeoutMinutes: 0 })
    withRlsContextMock
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: hash,
        failedLoginCount: 0,
        lockedUntil: null,
        totpEnabled: true,
        role: 'OWNER',
      })
      .mockResolvedValueOnce({ lockedUntil: null, failedLoginCount: 1, firmName: null })

    await expectInvalidCredentials(
      service.login({ firmSlug: 'firm', email: 'a@b.com', password: 'wrong' }, meta),
    )
  })

  it('returns generic 401 for locked account', async () => {
    const hash = await bcrypt.hash('pass', BCRYPT_PASSWORD_COST)
    resolveFirmMock.mockResolvedValue({ firmId, idleTimeoutMinutes: 0 })
    withRlsContextMock.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      passwordHash: hash,
      failedLoginCount: 3,
      lockedUntil: new Date(Date.now() + 60_000),
      totpEnabled: true,
      role: 'OWNER',
    })

    await expectInvalidCredentials(
      service.login({ firmSlug: 'firm', email: 'a@b.com', password: 'pass' }, meta),
    )
  })

  it('returns requiresTotpSetup when totp disabled', async () => {
    const hash = await bcrypt.hash('pass', BCRYPT_PASSWORD_COST)
    resolveFirmMock.mockResolvedValue({ firmId, idleTimeoutMinutes: 0 })
    withRlsContextMock
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: hash,
        failedLoginCount: 0,
        lockedUntil: null,
        totpEnabled: false,
        role: 'OWNER',
      })
      .mockResolvedValueOnce(undefined)

    const result = await service.login(
      { firmSlug: 'firm', email: 'a@b.com', password: 'pass' },
      meta,
    )
    expect(result).toEqual({ accessToken: 'partial-token', requiresTotpSetup: true })
  })

  it('returns requiresTotp when totp enabled', async () => {
    const hash = await bcrypt.hash('pass', BCRYPT_PASSWORD_COST)
    resolveFirmMock.mockResolvedValue({ firmId, idleTimeoutMinutes: 0 })
    withRlsContextMock
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: hash,
        failedLoginCount: 0,
        lockedUntil: null,
        totpEnabled: true,
        role: 'OWNER',
      })
      .mockResolvedValueOnce(undefined)

    const result = await service.login(
      { firmSlug: 'firm', email: 'a@b.com', password: 'pass' },
      meta,
    )
    expect(result).toEqual({ accessToken: 'partial-token', requiresTotp: true })
  })

  it('locks after third failure in single withRlsContext', async () => {
    const hash = await bcrypt.hash('pass', BCRYPT_PASSWORD_COST)
    resolveFirmMock.mockResolvedValue({ firmId, idleTimeoutMinutes: 0 })
    withRlsContextMock
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: hash,
        failedLoginCount: 2,
        lockedUntil: null,
        totpEnabled: true,
        role: 'OWNER',
      })
      .mockImplementationOnce((fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: { update: vi.fn() },
          auditLog: { create: vi.fn() },
          firm: { findUnique: vi.fn().mockResolvedValue({ name: 'Acme Tax' }) },
        }
        return fn(tx as never)
      })

    await expectInvalidCredentials(
      service.login({ firmSlug: 'firm', email: 'a@b.com', password: 'wrong' }, meta),
    )

    expect(withRlsContextMock).toHaveBeenCalledTimes(2)
  }, 20_000)
})
