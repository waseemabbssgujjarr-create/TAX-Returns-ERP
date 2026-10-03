import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'

import { AuditService } from './audit.service'

describe('AuditService', () => {
  let service: AuditService
  let prismaRls: PrismaRlsClient
  let withRlsContextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    withRlsContextMock = vi
      .fn()
      .mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ auditLog: { create: vi.fn().mockResolvedValue({ id: '1' }) } } as never),
      )
    prismaRls = {
      withRlsContext: withRlsContextMock,
    } as unknown as PrismaRlsClient
    service = new AuditService(prismaRls)
  })

  it('inserts audit row via withRlsContext', async () => {
    await service.log({
      action: 'auth.logout',
      firmId: 'f',
      userId: 'u',
      payload: {},
    })
    expect(withRlsContextMock).toHaveBeenCalled()
  })

  it('does not throw when insert fails', async () => {
    withRlsContextMock.mockRejectedValue(new Error('db down'))
    await expect(
      service.log({
        action: 'auth.logout',
        firmId: 'f',
        userId: 'u',
        payload: {},
      }),
    ).resolves.toBeUndefined()
  })
})
