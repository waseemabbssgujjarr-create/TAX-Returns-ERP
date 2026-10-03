import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReturnPreparationService } from './return-preparation.service'

vi.mock('./tax-year-access.util', () => ({
  resolveTaxYearFileForStaff: vi.fn(() =>
    Promise.resolve({
      id: 'ty-1',
      firmId: 'firm-1',
      clientId: 'client-1',
      taxYear: 2025,
    }),
  ),
}))

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    taxYear: 2025,
    clientId: '11111111-1111-4111-8111-111111111111',
    assembledAt: '2025-10-02T00:00:00.000Z',
    rulesVersion: '1.0.0',
    rulesState: 'AVAILABLE',
    filingDisclaimer: 'NOT_IRIS_FBR_SUBMISSION',
    sections: {},
    sectionCompleteness: { complete: 12, total: 12 },
    fields: [],
    missing: [],
    validation: {
      status: 'approved_gate_ok',
      canSubmitForReview: true,
      canApprove: true,
      errorCount: 0,
      warningCount: 0,
      issues: [],
    },
    wealth: {
      present: true,
      status: 'RECONCILED',
      reviewStatus: 'APPROVED',
      discrepancyPaisa: '0',
    },
    withholding: {
      entryCount: 1,
      matchedCount: 1,
      unmatchedCount: 0,
      totalTaxDeductedPaisa: '100',
    },
    computation: {
      snapshotId: '22222222-2222-4222-8222-222222222222',
      status: 'SUCCESS',
      rulesVersion: '1.0.0',
      taxPayablePaisa: '1',
    },
    documents: { count: 1 },
    warnings: [],
    checklist: {
      sectionsComplete: true,
      wealthReviewed: true,
      withholdingReconciled: true,
      computationOk: true,
      humanReviewRequired: true,
    },
    ...overrides,
  }
}

describe('ReturnPreparationService approval gates', () => {
  const audit = { log: vi.fn(() => Promise.resolve(undefined)) }
  let row: Record<string, unknown>
  let service: ReturnPreparationService

  beforeEach(() => {
    row = {
      id: 'rp-1',
      taxYearFileId: 'ty-1',
      firmId: 'firm-1',
      structuredJson: makeDraft(),
      reviewStatus: 'IN_REVIEW',
      assignedReviewerId: null,
      submittedAt: new Date(),
      submittedById: 'user-1',
      approvedAt: null,
      approvedById: null,
      approvalComment: null,
      updatedAt: new Date(),
    }

    const prismaRls = {
      withRlsContext: vi.fn((fn: (tx: unknown) => unknown) => {
        const tx = {
          returnPreparation: {
            findUnique: vi.fn(() => Promise.resolve(row)),
            update: vi.fn(({ data }: { data: Record<string, unknown> }) => {
              row = { ...row, ...data }
              return Promise.resolve(row)
            }),
            upsert: vi.fn(() => Promise.resolve(row)),
          },
          auditLog: {
            findMany: vi.fn(() => Promise.resolve([])),
          },
        }
        return fn(tx)
      }),
    }

    service = new ReturnPreparationService(prismaRls as never, audit as never)
    audit.log.mockClear()
  })

  const owner = {
    userId: 'user-1',
    firmId: 'firm-1',
    role: UserRole.OWNER,
    sessionState: 'full' as const,
    sessionType: 'staff' as const,
    jti: 'jti-1',
  }

  const associate = { ...owner, role: UserRole.ASSOCIATE, userId: 'user-2', jti: 'jti-2' }

  it('blocks associate from approving', async () => {
    await expect(service.approve(associate, 'ty-1', {})).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('approves when validation gate is clear', async () => {
    const dto = await service.approve(owner, 'ty-1', { comment: 'Looks good' })
    expect(dto.reviewStatus).toBe('APPROVED')
    expect(dto.approvalComment).toBe('Looks good')
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'return_preparation.approve' }),
    )
  })

  it('rejects approve when draft rules block gate', async () => {
    row.structuredJson = makeDraft({
      rulesState: 'DRAFT',
      validation: {
        status: 'blocked',
        canSubmitForReview: false,
        canApprove: false,
        errorCount: 1,
        warningCount: 0,
        issues: [],
      },
    })
    await expect(service.approve(owner, 'ty-1', {})).rejects.toBeInstanceOf(BadRequestException)
  })

  it('blocks assemble when already approved', async () => {
    row.reviewStatus = 'APPROVED'
    await expect(service.assemble(owner, 'ty-1')).rejects.toBeInstanceOf(ConflictException)
  })

  it('submits draft for review when validation allows', async () => {
    row.reviewStatus = 'DRAFT'
    const dto = await service.submitForReview(owner, 'ty-1')
    expect(dto.reviewStatus).toBe('IN_REVIEW')
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'return_preparation.submit_review' }),
    )
  })
})
