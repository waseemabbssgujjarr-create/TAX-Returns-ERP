import { UserRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'

import { WealthStatementService } from './wealth-statement.service'

describe('WealthStatementService', () => {
  let service: WealthStatementService
  let prismaRls: PrismaRlsClient
  let audit: AuditService
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let auditLogMock: ReturnType<typeof vi.fn>

  const user: AuthenticatedUser = {
    userId: 'u-1',
    firmId: 'firm-1',
    role: UserRole.OWNER,
    sessionState: 'full',
    sessionType: 'staff',
    jti: 'j',
  }

  beforeEach(() => {
    auditLogMock = vi.fn().mockResolvedValue(undefined)
    audit = { log: auditLogMock } as unknown as AuditService

    withRlsContextMock = vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        taxYearFile: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'tyf-1',
            clientId: 'c-1',
            taxYear: 2025,
            client: { firmId: 'firm-1' },
          }),
        },
        clientAccess: { findUnique: vi.fn() },
        wealthStatement: {
          upsert: vi.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
            Promise.resolve({
              ...create,
              updatedAt: new Date(),
            }),
          ),
          findUnique: vi.fn(),
        },
      }
      return fn(tx as never)
    })

    prismaRls = {
      withRlsContext: withRlsContextMock,
    } as unknown as PrismaRlsClient

    service = new WealthStatementService(prismaRls, audit)
  })

  it('persists discrepancy without adjusting closing wealth', async () => {
    const result = await service.upsert(user, 'tyf-1', {
      openingWealthPaisa: '0',
      closingWealthPaisa: '1000',
      incomeTotalPaisa: '2000',
      expenseTotalPaisa: '500',
      taxTotalPaisa: '100',
    })

    expect(result.status).toBe('DISCREPANCY')
    expect(result.discrepancyPaisa).not.toBe('0')
    expect(result.closingWealthPaisa).toBe('1000')
    expect(auditLogMock).toHaveBeenCalled()
  })
})
