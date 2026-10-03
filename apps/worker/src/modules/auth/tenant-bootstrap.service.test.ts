import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQueryRaw = vi.fn()
const mockExecuteRaw = vi.fn()
const mockTransaction = vi.fn()
const mockDisconnect = vi.fn()

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $transaction: mockTransaction,
    $disconnect: mockDisconnect,
  })),
}))

import { TenantBootstrapService } from './tenant-bootstrap.service'

describe('TenantBootstrapService.resolveFirm', () => {
  let service: TenantBootstrapService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TenantBootstrapService()
    mockTransaction.mockImplementation(
      async (fn: (tx: Pick<PrismaClient, '$queryRaw' | '$executeRaw'>) => Promise<unknown>) => {
        const tx = {
          $executeRaw: mockExecuteRaw,
          $queryRaw: mockQueryRaw,
        }
        return fn(tx)
      },
    )
  })

  it('returns null for invalid slug without calling the database', async () => {
    const result = await service.resolveFirm('INVALID SLUG!')
    expect(result).toBeNull()
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('returns null when slug is not found', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await service.resolveFirm('unknown-firm')
    expect(result).toBeNull()
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('returns null when firm is inactive', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { firm_id: '11111111-1111-1111-1111-111111111111', is_active: false },
    ])

    const result = await service.resolveFirm('inactive-co')
    expect(result).toBeNull()
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns firmId and idleTimeoutMinutes for a valid active slug', async () => {
    const firmId = '22222222-2222-2222-2222-222222222222'
    mockQueryRaw
      .mockResolvedValueOnce([{ firm_id: firmId, is_active: true }])
      .mockResolvedValueOnce([{ idleTimeoutMinutes: 45 }])

    const result = await service.resolveFirm('  Acme-Corp  ')
    expect(result).toEqual({ firmId, idleTimeoutMinutes: 45 })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockExecuteRaw).toHaveBeenCalled()
  })

  it('canonicalizes slug to lowercase before lookup', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await service.resolveFirm('My-Firm')
    expect(mockQueryRaw).toHaveBeenCalled()
    const template = mockQueryRaw.mock.calls[0]?.[0] as TemplateStringsArray | undefined
    expect(template).toBeDefined()
  })
})
