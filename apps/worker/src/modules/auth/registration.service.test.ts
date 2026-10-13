import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { KeyManagementService } from '../kms/kms.interface'
import type { NotificationProvider } from '../notifications/notification.provider'

import { RegistrationService } from './registration.service'
import { buildVerificationTokenRaw, hashVerificationToken } from './registration.util'
import type { TenantBootstrapService } from './tenant-bootstrap.service'

describe('RegistrationService', () => {
  let service: RegistrationService
  let prismaRls: PrismaRlsClient
  let tenantBootstrap: TenantBootstrapService
  let kms: KeyManagementService
  let notifications: NotificationProvider
  let sendEmailMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendEmailMock = vi.fn().mockResolvedValue(undefined)
    prismaRls = {
      withRegistrationBootstrap: vi.fn(),
    } as unknown as PrismaRlsClient

    tenantBootstrap = {
      resolveFirm: vi.fn().mockResolvedValue(null),
    } as unknown as TenantBootstrapService

    kms = {
      generateDataKey: vi.fn().mockResolvedValue({
        plaintext: Buffer.alloc(32, 1),
        wrapped: 'wrapped-key',
      }),
    } as unknown as KeyManagementService

    notifications = {
      sendEmail: sendEmailMock,
      sendSms: vi.fn(),
    }

    service = new RegistrationService(prismaRls, tenantBootstrap, kms, notifications)
  })

  it('verifyEmail rejects invalid token format', async () => {
    const result = await service.verifyEmail('not-a-token')
    expect(result.status).toBe('invalid_token')
  })

  it('register sends verification email on success', async () => {
    const tx = {
      firm: { create: vi.fn() },
      user: { create: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
      emailVerificationToken: {
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    }
    ;(prismaRls.withRegistrationBootstrap as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async (_firmId, _userId, fn: (inner: typeof tx) => Promise<void>) => {
        await fn(tx)
      })
      .mockImplementationOnce(async (_firmId, _userId, fn: (inner: typeof tx) => Promise<void>) => {
        await fn(tx)
      })

    const result = await service.register({
      firmName: 'Acme Tax',
      contactName: 'Owner',
      email: 'owner@example.com',
      password: 'secure-password-1',
      phone: '+923001234567',
      city: 'Lahore',
      firmSize: 'small',
    })

    expect(result.status).toBe('verification_sent')
    expect(sendEmailMock).toHaveBeenCalled()
    expect(tx.firm.create).toHaveBeenCalled()
    expect(tx.user.create).toHaveBeenCalled()
  })

  it('register reports email delivery failure honestly', async () => {
    sendEmailMock.mockRejectedValue(new Error('smtp down'))

    const tx = {
      firm: { create: vi.fn() },
      user: { create: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
      emailVerificationToken: { create: vi.fn(), updateMany: vi.fn() },
    }
    ;(prismaRls.withRegistrationBootstrap as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async (_firmId, _userId, fn: (inner: typeof tx) => Promise<void>) => {
        await fn(tx)
      })
      .mockImplementationOnce(async (_firmId, _userId, fn: (inner: typeof tx) => Promise<void>) => {
        await fn(tx)
      })

    const result = await service.register({
      firmName: 'Acme Tax',
      contactName: 'Owner',
      email: 'owner@example.com',
      password: 'secure-password-1',
      phone: '+923001234567',
      city: 'Lahore',
      firmSize: 'small',
    })

    expect(result).toEqual({
      status: 'verification_pending',
      firmSlug: 'acme-tax',
      emailDeliveryFailed: true,
    })
  })

  it('verifyEmail marks token verified', async () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const raw = buildVerificationTokenRaw(firmId)
    const tokenHash = hashVerificationToken(raw)
    const userId = '22222222-2222-2222-2222-222222222222'

    const tx = {
      emailVerificationToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tok-1',
          firmId,
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
          user: { emailVerifiedAt: null, email: 'owner@example.com' },
          firm: { slug: 'acme-tax' },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: vi.fn() },
      firm: { update: vi.fn() },
      auditLog: { create: vi.fn() },
    }
    ;(prismaRls.withRegistrationBootstrap as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async (_firmId, _userId, fn: (inner: typeof tx) => Promise<unknown>) =>
        fn(tx),
      )
      .mockImplementationOnce(async (_firmId, _userId, fn: (inner: typeof tx) => Promise<void>) => {
        await fn(tx)
      })

    const result = await service.verifyEmail(raw)
    expect(result).toEqual({ status: 'verified', firmSlug: 'acme-tax' })
  })
})
