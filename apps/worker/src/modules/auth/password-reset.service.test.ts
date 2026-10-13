import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { NotificationProvider } from '../notifications/notification.provider'

import { PasswordResetService } from './password-reset.service'
import { buildVerificationTokenRaw, hashVerificationToken } from './registration.util'
import type { TenantBootstrapService } from './tenant-bootstrap.service'
import type { TokenService } from './token.service'

describe('PasswordResetService', () => {
  let service: PasswordResetService
  let prismaRls: PrismaRlsClient
  let tenantBootstrap: TenantBootstrapService
  let tokenService: TokenService
  let notifications: NotificationProvider
  let sendEmailMock: ReturnType<typeof vi.fn>
  let revokeAllRefreshTokensMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendEmailMock = vi.fn().mockResolvedValue(undefined)
    prismaRls = {
      withRlsContext: vi.fn(),
      withRegistrationBootstrap: vi.fn(),
    } as unknown as PrismaRlsClient

    tenantBootstrap = {
      resolveFirm: vi.fn().mockResolvedValue({ firmId: 'firm-1' }),
    } as unknown as TenantBootstrapService

    revokeAllRefreshTokensMock = vi.fn().mockResolvedValue(undefined)
    tokenService = {
      revokeAllRefreshTokens: revokeAllRefreshTokensMock,
    } as unknown as TokenService

    notifications = {
      sendEmail: sendEmailMock,
      sendSms: vi.fn(),
    }

    service = new PasswordResetService(prismaRls, tenantBootstrap, tokenService, notifications)
  })

  it('requestReset returns generic success when firm is unknown', async () => {
    ;(tenantBootstrap.resolveFirm as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await service.requestReset({ firmSlug: 'missing', email: 'a@b.com' })
    expect(result).toEqual({ status: 'reset_email_sent' })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('requestReset sends email for verified active user', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          isActive: true,
          emailVerifiedAt: new Date(),
          lastPasswordResetSentAt: null,
        }),
        update: vi.fn(),
      },
      firm: { findUnique: vi.fn().mockResolvedValue({ name: 'Acme', slug: 'acme' }) },
      passwordResetToken: { create: vi.fn(), updateMany: vi.fn() },
    }
    ;(prismaRls.withRlsContext as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    )

    const result = await service.requestReset({ firmSlug: 'acme', email: 'owner@example.com' })
    expect(result.status).toBe('reset_email_sent')
    expect(sendEmailMock).toHaveBeenCalled()
  })

  it('confirmReset rejects invalid token format', async () => {
    const result = await service.confirmReset('bad', 'new-password-12')
    expect(result.status).toBe('invalid_token')
  })

  it('confirmReset updates password and revokes sessions', async () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const raw = buildVerificationTokenRaw(firmId)
    const tokenHash = hashVerificationToken(raw)

    const tx = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tok-1',
          firmId,
          userId: 'user-1',
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { email: 'owner@example.com' },
          firm: { slug: 'acme' },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: vi.fn() },
      auditLog: { create: vi.fn() },
    }
    ;(prismaRls.withRegistrationBootstrap as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async (_f, _u, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx))
      .mockImplementationOnce(async (_f, _u, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx))

    const result = await service.confirmReset(raw, 'new-password-12')
    expect(result).toEqual({ status: 'password_updated', firmSlug: 'acme' })
    expect(revokeAllRefreshTokensMock).toHaveBeenCalledWith('user-1', firmId)
    expect(tx.passwordResetToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash } }),
    )
  })
})
