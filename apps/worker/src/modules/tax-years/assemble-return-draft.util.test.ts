import { beforeEach, describe, expect, it } from 'vitest'

import { assembleReturnDraft } from './assemble-return-draft.util'

describe('assembleReturnDraft', () => {
  const base = {
    taxYear: 2025,
    clientId: '11111111-1111-4111-8111-111111111111',
    rulesVersion: '0.1.0-DRAFT' as string | null,
    sections: {
      income: { complete: true, provenance: 'editable' },
      salary: { complete: false, provenance: 'extracted' },
    } as Record<string, unknown>,
    wealth: null as null | {
      status: string
      reviewStatus: string
      discrepancyPaisa: string
    },
    withholding: [] as Array<{ matched: boolean; taxDeductedPaisa: string }>,
    computation: null as null | {
      snapshotId: string
      status: string
      rulesVersion: string | null
      resultJson: unknown
    },
    documentCount: 0,
    assembledAt: '2025-10-02T00:00:00.000Z',
  }

  beforeEach(() => {
    // stable base clone not required — each test spreads
  })

  it('marks draft rules and never claims filing readiness', () => {
    const draft = assembleReturnDraft(base)
    expect(draft.schemaVersion).toBe(1)
    expect(draft.filingDisclaimer).toBe('NOT_IRIS_FBR_SUBMISSION')
    expect(draft.rulesState).toBe('DRAFT')
    expect(draft.checklist.humanReviewRequired).toBe(true)
    expect(draft.checklist.computationOk).toBe(false)
    expect(draft.warnings.some((w) => w.code === 'RULES_DRAFT')).toBe(true)
    expect(draft.warnings.some((w) => w.code === 'NOT_FILING')).toBe(true)
  })

  it('aggregates withholding match counts without inventing tax logic', () => {
    const draft = assembleReturnDraft({
      ...base,
      rulesVersion: null,
      withholding: [
        { matched: true, taxDeductedPaisa: '100' },
        { matched: false, taxDeductedPaisa: '50' },
      ],
    })
    expect(draft.withholding.entryCount).toBe(2)
    expect(draft.withholding.matchedCount).toBe(1)
    expect(draft.withholding.unmatchedCount).toBe(1)
    expect(draft.withholding.totalTaxDeductedPaisa).toBe('150')
    expect(draft.checklist.withholdingReconciled).toBe(false)
  })

  it('only sets computationOk when SUCCESS and non-draft rules', () => {
    const draft = assembleReturnDraft({
      ...base,
      rulesVersion: '1.0.0',
      computation: {
        snapshotId: '22222222-2222-4222-8222-222222222222',
        status: 'SUCCESS',
        rulesVersion: '1.0.0',
        resultJson: { taxPayablePaisa: '999' },
      },
    })
    expect(draft.rulesState).toBe('AVAILABLE')
    expect(draft.checklist.computationOk).toBe(true)
    expect(draft.computation?.taxPayablePaisa).toBe('999')
  })

  it('exposes field states, missing panel, and blocked validation for draft rules', () => {
    const draft = assembleReturnDraft(base)
    expect(draft.fields.length).toBeGreaterThan(0)
    expect(draft.fields.some((f) => f.state === 'entered')).toBe(true)
    expect(draft.fields.some((f) => f.state === 'missing' || f.state === 'needs_review')).toBe(true)
    expect(draft.missing.length).toBeGreaterThan(0)
    expect(draft.validation.status).toBe('blocked')
    expect(draft.validation.canApprove).toBe(false)
    expect(draft.validation.canSubmitForReview).toBe(false)
  })

  it('maps verified provenance to verified field state', () => {
    const draft = assembleReturnDraft({
      ...base,
      sections: {
        income: { complete: true, provenance: 'verified' },
      },
    })
    const income = draft.fields.find((f) => f.path === 'sections.income')
    expect(income?.state).toBe('verified')
  })
})
