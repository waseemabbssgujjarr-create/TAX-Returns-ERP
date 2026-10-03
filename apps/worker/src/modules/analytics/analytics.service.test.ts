import { ForbiddenException } from '@nestjs/common'
import { TaxYearStatus, UserRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuthenticatedUser } from '../auth/auth.types'

import { AnalyticsService } from './analytics.service'

describe('AnalyticsService', () => {
  let service: AnalyticsService
  let prismaRls: PrismaRlsClient
  let withRlsContextMock: ReturnType<typeof vi.fn>

  const owner: AuthenticatedUser = {
    userId: 'user-1',
    firmId: 'firm-1',
    role: UserRole.OWNER,
    sessionState: 'full',
    sessionType: 'staff',
    jti: 'jti',
  }

  beforeEach(() => {
    withRlsContextMock = vi.fn()
    prismaRls = {
      withRlsContext: withRlsContextMock,
    } as unknown as PrismaRlsClient
    service = new AnalyticsService(prismaRls)
  })

  it('rejects non-staff sessions', async () => {
    await expect(
      service.getOverview({ ...owner, sessionType: 'portal', clientId: 'c-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('aggregates firm-scoped metrics via RLS client', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        client: { count: vi.fn().mockResolvedValue(12) },
        taxYearFile: {
          groupBy: vi
            .fn()
            .mockResolvedValue([{ status: TaxYearStatus.IN_PROGRESS, _count: { _all: 4 } }]),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
        document: { count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2) },
        notice: {
          count: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(1),
          findMany: vi.fn().mockResolvedValue([]),
          groupBy: vi.fn().mockResolvedValue([]),
        },
        invoice: {
          findMany: vi.fn().mockResolvedValue([
            { status: 'SENT', balancePaisa: 1000n },
            { status: 'PAID', balancePaisa: 0n },
          ]),
        },
        payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountPaisa: 5000n } }) },
        complianceEvent: {
          count: vi.fn().mockResolvedValue(2),
          findMany: vi.fn().mockResolvedValue([]),
        },
        user: {
          findMany: vi.fn().mockResolvedValue([{ id: 'user-1', name: 'Owner User' }]),
        },
        returnPreparation: {
          groupBy: vi.fn().mockResolvedValue([
            { reviewStatus: 'IN_REVIEW', _count: { _all: 2 } },
            { reviewStatus: 'APPROVED', _count: { _all: 1 } },
          ]),
        },
      }
      return fn(tx as never)
    })

    const overview = await service.getOverview(owner)

    expect(withRlsContextMock).toHaveBeenCalledOnce()
    expect(overview.activeClients).toBe(12)
    expect(overview.pendingDocuments).toBe(3)
    expect(overview.pendingReviews).toBe(2)
    expect(overview.openNotices).toBe(5)
    expect(overview.invoices.totalOutstandingPaisa).toBe('1000')
    expect(overview.invoices.totalCollectedPaisa).toBe('5000')
    expect(overview.taxYearByStatus[TaxYearStatus.IN_PROGRESS]).toBe(4)
    expect(overview.returnPrepByStatus.IN_REVIEW).toBe(2)
    expect(overview.returnPrepByStatus.APPROVED).toBe(1)
    expect(overview.upcomingDeadlinesCount).toBe(3)
  })
})
