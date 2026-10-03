import { HttpException, UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcrypt'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { NotificationProvider } from '../notifications/notification.provider'

import { OtpService, OTP_SEND_RESPONSE, contactHmac, normaliseContact } from './otp.service'
import type { PortalClientLookup } from './portal-client.lookup'
import type { TenantBootstrapService } from './tenant-bootstrap.service'
import type { TokenService } from './token.service'

describe('OtpService', () => {
  let service: OtpService
  let tenantBootstrap: TenantBootstrapService
  let prismaRls: PrismaRlsClient
  let tokenService: TokenService
  let portalLookup: PortalClientLookup
  let notifications: NotificationProvider
  let resolveFirmMock: ReturnType<typeof vi.fn>
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let sendEmailMock: ReturnType<typeof vi.fn>

  const firmId = '11111111-1111-1111-1111-111111111111'
  const clientId = '33333333-3333-3333-3333-333333333333'

  beforeEach(() => {
    resolveFirmMock = vi.fn().mockResolvedValue({ firmId, idleTimeoutMinutes: 0 })
    withRlsContextMock = vi.fn()
    sendEmailMock = vi.fn()

    tenantBootstrap = {
      resolveFirm: resolveFirmMock,
      prismaBootstrap: {} as never,
      onModuleDestroy: vi.fn(),
    } as unknown as TenantBootstrapService
    prismaRls = { withRlsContext: withRlsContextMock } as unknown as PrismaRlsClient
    tokenService = {
      issueFullJwt: vi.fn().mockReturnValue({ accessToken: 'access', jti: 'jti' }),
      issueRefreshToken: vi.fn().mockResolvedValue({ rawToken: 'refresh.raw', recordId: '1' }),
    } as unknown as TokenService
    portalLookup = { resolveClientId: vi.fn().mockResolvedValue(clientId) }
    notifications = { sendEmail: sendEmailMock, sendSms: vi.fn() }

    service = new OtpService(tenantBootstrap, prismaRls, tokenService, portalLookup, notifications)
  })

  it('sendOtp returns same response for unknown firm', async () => {
    resolveFirmMock.mockResolvedValue(null)
    const res = await service.sendOtp({ firmSlug: 'x', contact: 'a@b.com', channel: 'email' }, {})
    expect(res).toEqual(OTP_SEND_RESPONSE)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('contact normalisation produces same HMAC', () => {
    const a = contactHmac(normaliseContact('User@Example.Com'))
    const b = contactHmac(normaliseContact('user@example.com'))
    expect(a).toBe(b)
  })

  it('HMAC is deterministic across calls', () => {
    expect(contactHmac('test@example.com')).toBe(contactHmac('test@example.com'))
  })

  it('rate limits after 3 sends per hour', async () => {
    withRlsContextMock.mockResolvedValueOnce(3)
    await expect(
      service.sendOtp({ firmSlug: 'f', contact: 'a@b.com', channel: 'email' }, {}),
    ).rejects.toBeInstanceOf(HttpException)
  })

  it('sendOtp inserts OTP and sends email outside transaction order', async () => {
    const calls: string[] = []
    withRlsContextMock
      .mockResolvedValueOnce(0)
      .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
        calls.push('tx-start')
        const result = fn({
          otpCode: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
          auditLog: { create: vi.fn() },
        } as never)
        calls.push('tx-end')
        return result
      })
    sendEmailMock.mockImplementation(() => {
      calls.push('email')
      return Promise.resolve()
    })

    await service.sendOtp({ firmSlug: 'f', contact: 'a@b.com', channel: 'email' }, {})
    expect(calls.indexOf('tx-end')).toBeLessThan(calls.indexOf('email'))
  })

  it('verify success consumes OTP and issues tokens', async () => {
    const otp = '123456'
    const otpHash = await bcrypt.hash(otp, 10)
    const record = {
      id: 'otp-1',
      otpHash,
      attempts: 0,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }

    withRlsContextMock.mockResolvedValueOnce(record).mockResolvedValueOnce(undefined)

    const result = await service.verifyOtp({ firmSlug: 'f', contact: 'a@b.com', code: otp }, {})
    expect(result.accessToken).toBe('access')
    expect(result.rawRefreshToken).toBe('refresh.raw')
  })

  it('rejects reuse after consumed OTP', async () => {
    withRlsContextMock.mockResolvedValueOnce(null)
    await expect(
      service.verifyOtp({ firmSlug: 'f', contact: 'a@b.com', code: '123456' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects expired OTP', async () => {
    withRlsContextMock.mockResolvedValueOnce(null)
    await expect(
      service.verifyOtp({ firmSlug: 'f', contact: 'a@b.com', code: '123456' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('invalidates OTP after 3 wrong attempts', async () => {
    const otpHash = await bcrypt.hash('999999', 10)
    const record = {
      id: 'otp-1',
      otpHash,
      attempts: 2,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }
    const update = vi.fn()

    withRlsContextMock
      .mockResolvedValueOnce(record)
      .mockImplementationOnce((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ otpCode: { update }, auditLog: { create: vi.fn() } } as never),
      )

    await expect(
      service.verifyOtp({ firmSlug: 'f', contact: 'a@b.com', code: '000000' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attempts: 3, usedAt: expect.any(Date) as Date },
      }),
    )
  })

  it('verify uses latest OTP record (replacement)', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'latest',
      otpHash: await bcrypt.hash('999999', 10),
      attempts: 0,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    })
    withRlsContextMock
      .mockImplementationOnce((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ otpCode: { findFirst } } as never),
      )
      .mockImplementationOnce((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ otpCode: { update: vi.fn() }, auditLog: { create: vi.fn() } } as never),
      )

    await expect(
      service.verifyOtp({ firmSlug: 'f', contact: 'a@b.com', code: '123456' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    )
  })

  it('verify errors share same problem title', async () => {
    withRlsContextMock.mockResolvedValue(null)
    const run = () => service.verifyOtp({ firmSlug: 'f', contact: 'a@b.com', code: '000000' }, {})
    await expect(run()).rejects.toMatchObject({
      response: expect.objectContaining({ title: 'Invalid code.' }) as { title: string },
    })
  })
})
