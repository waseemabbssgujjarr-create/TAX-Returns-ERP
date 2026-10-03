import type { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { INV1_ERROR, PrismaRlsClient } from './prisma-rls.client'
import type { PrismaService } from './prisma.service'
import { rlsIdentityStorage, rlsTransactionStorage } from './rls-context.store'

const identity = {
  firmId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  sessionType: 'staff' as const,
}

function createMockTx(id: string): Prisma.TransactionClient {
  return {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn(),
    __id: id,
  } as unknown as Prisma.TransactionClient
}

describe('PrismaRlsClient.withRlsContext', () => {
  let transactionCount: number
  let prismaRls: PrismaRlsClient
  let outerTx: Prisma.TransactionClient
  let innerTransactionFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    transactionCount = 0
    innerTransactionFn = vi.fn(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        transactionCount += 1
        outerTx = createMockTx(`tx-${transactionCount}`)
        return callback(outerTx)
      },
    )

    const prisma = {
      $transaction: innerTransactionFn,
    } as unknown as PrismaService

    prismaRls = new PrismaRlsClient(prisma)
  })

  it('throws fail-closed when no ALS identity is present', async () => {
    await expect(prismaRls.withRlsContext(() => Promise.resolve('noop'))).rejects.toThrow(
      INV1_ERROR,
    )
    expect(innerTransactionFn).not.toHaveBeenCalled()
  })

  it('opens separate transactions for sequential withRlsContext calls (IC-1)', async () => {
    await rlsIdentityStorage.run(identity, async () => {
      await prismaRls.withRlsContext(() => Promise.resolve('first'))
      await prismaRls.withRlsContext(() => Promise.resolve('second'))
    })

    expect(transactionCount).toBe(2)
  })

  it('reuses the active transaction for nested withRlsContext (IC-1)', async () => {
    await rlsIdentityStorage.run(identity, async () => {
      await prismaRls.withRlsContext((outer) =>
        prismaRls.withRlsContext((inner) => {
          expect(inner).toBe(outer)
          return Promise.resolve()
        }),
      )
    })

    expect(transactionCount).toBe(1)
  })

  it('rolls back atomically when an inner operation fails', async () => {
    const rollbackSpy = vi.fn()

    innerTransactionFn.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const tx = createMockTx('atomic')
        try {
          return await callback(tx)
        } catch (error) {
          rollbackSpy(error)
          throw error
        }
      },
    )

    await rlsIdentityStorage.run(identity, async () => {
      await expect(
        prismaRls.withRlsContext(async (tx) => {
          await tx.$executeRaw`SELECT 1`
          throw new Error('second step failed')
        }),
      ).rejects.toThrow('second step failed')
    })

    expect(rollbackSpy).toHaveBeenCalledTimes(1)
  })

  it('sets RLS session variables via set_config on new transactions', async () => {
    await rlsIdentityStorage.run(identity, async () => {
      await prismaRls.withRlsContext((tx) => {
        expect(tx.$executeRaw).toHaveBeenCalled()
        return Promise.resolve()
      })
    })
  })

  it('does not nest rlsTransactionStorage outside an active transaction', () => {
    expect(rlsTransactionStorage.getStore()).toBeUndefined()
  })
})
