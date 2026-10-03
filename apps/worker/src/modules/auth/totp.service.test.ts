import { authenticator } from 'otplib'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { KeyManagementService } from '../kms/kms.interface'

import { TotpService } from './totp.service'

describe('TotpService', () => {
  let service: TotpService
  let prismaRls: PrismaRlsClient
  let kms: KeyManagementService
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let withPreAuthFirmContextMock: ReturnType<typeof vi.fn>
  let encryptWithDataKeyMock: ReturnType<typeof vi.fn>
  let decryptWithDataKeyMock: ReturnType<typeof vi.fn>

  const firmId = '11111111-1111-1111-1111-111111111111'
  const userId = '22222222-2222-2222-2222-222222222222'

  beforeEach(() => {
    encryptWithDataKeyMock = vi.fn().mockResolvedValue('cipher-blob-base64')
    decryptWithDataKeyMock = vi.fn().mockImplementation((_key: Buffer, cipher: string) => {
      if (cipher === 'cipher-blob-base64') {
        return Promise.resolve(Buffer.from(authenticator.generateSecret(), 'utf8'))
      }
      return Promise.resolve(Buffer.from('SECRETBASE32', 'utf8'))
    })

    kms = {
      generateDataKey: vi.fn().mockResolvedValue({
        plaintext: Buffer.alloc(32, 1),
        wrapped: 'wrapped-key',
      }),
      unwrapDataKey: vi.fn().mockResolvedValue(Buffer.alloc(32, 1)),
      encryptWithDataKey: encryptWithDataKeyMock,
      decryptWithDataKey: decryptWithDataKeyMock,
    }

    withRlsContextMock = vi.fn()
    withPreAuthFirmContextMock = vi.fn()

    prismaRls = {
      withRlsContext: withRlsContextMock,
      withPreAuthFirmContext: withPreAuthFirmContextMock,
    } as unknown as PrismaRlsClient

    service = new TotpService(prismaRls, kms)
  })

  it('initiateSetup stores ciphertext not plaintext secret', async () => {
    let stored: string | undefined
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        firm: {
          findUnique: vi.fn().mockResolvedValue({ encryptedDataKey: 'wrapped-key' }),
          update: vi.fn(),
        },
        user: {
          update: vi
            .fn()
            .mockImplementation(({ data }: { data: { totpSetupPendingSecret: string } }) => {
              stored = data.totpSetupPendingSecret
              return Promise.resolve({})
            }),
        },
        auditLog: { create: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await service.initiateSetup(userId, firmId, 'user@example.com')
    expect(stored).toBe('cipher-blob-base64')
    expect(stored).not.toBe(result.secretDisplayText.replace(/\s/g, ''))
    expect(encryptWithDataKeyMock).toHaveBeenCalled()
  })

  it('confirmSetup writes recovery codes and audit in one withRlsContext', async () => {
    const secret = authenticator.generateSecret()
    decryptWithDataKeyMock.mockResolvedValue(Buffer.from(secret, 'utf8'))
    const code = authenticator.generate(secret)

    withRlsContextMock
      .mockResolvedValueOnce({
        totpSetupPendingSecret: 'cipher-blob-base64',
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .mockImplementationOnce((fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: { update: vi.fn() },
          recoveryCode: { createMany: vi.fn() },
          auditLog: { create: vi.fn() },
        }
        return fn(tx as never)
      })

    withPreAuthFirmContextMock.mockImplementation(
      (_f: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          firm: { findUnique: vi.fn().mockResolvedValue({ encryptedDataKey: 'wrapped-key' }) },
        } as never),
    )

    const result = await service.confirmSetup(userId, firmId, code)
    expect(result.recoveryCodes).toHaveLength(10)
    expect(withRlsContextMock).toHaveBeenCalledTimes(2)
  })
})
