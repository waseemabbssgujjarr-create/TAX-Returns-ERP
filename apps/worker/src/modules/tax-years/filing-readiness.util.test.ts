import { describe, expect, it } from 'vitest'

import { computeFilingReadiness, type FilingReadinessInput } from './filing-readiness.util'

const BASE: FilingReadinessInput = {
  returnPrepReviewStatus: 'APPROVED',
  returnPrepValidationStatus: 'approved_gate_ok',
  wealthStatus: 'RECONCILED',
  wealthReviewStatus: 'APPROVED',
  withholdingUnmatchedCount: 0,
  withholdingInvalidCount: 0,
  withholdingMissingCprCount: 0,
  documentCount: 2,
}

describe('computeFilingReadiness', () => {
  it('is ready to file when every error-level gate passes', () => {
    const result = computeFilingReadiness(BASE)
    expect(result.readyToFile).toBe(true)
    expect(result.items.every((i) => i.ok)).toBe(true)
  })

  it('blocks when return preparation is not approved', () => {
    const result = computeFilingReadiness({ ...BASE, returnPrepReviewStatus: 'IN_REVIEW' })
    expect(result.readyToFile).toBe(false)
    const item = result.items.find((i) => i.code === 'RETURN_PREP_APPROVED')
    expect(item?.ok).toBe(false)
    expect(item?.severity).toBe('error')
  })

  it('blocks when wealth statement is not reconciled/approved', () => {
    const result = computeFilingReadiness({ ...BASE, wealthStatus: 'DISCREPANCY' })
    expect(result.readyToFile).toBe(false)
  })

  it('does not block on unmatched withholding or missing documents (warning-level only)', () => {
    const result = computeFilingReadiness({
      ...BASE,
      withholdingUnmatchedCount: 3,
      documentCount: 0,
    })
    expect(result.readyToFile).toBe(true)
    const withholdingItem = result.items.find((i) => i.code === 'WITHHOLDING_MATCHED')
    const docsItem = result.items.find((i) => i.code === 'DOCUMENTS_ATTACHED')
    expect(withholdingItem?.ok).toBe(false)
    expect(withholdingItem?.severity).toBe('warning')
    expect(docsItem?.ok).toBe(false)
    expect(docsItem?.severity).toBe('warning')
  })

  it('blocks when any withholding row fails IRIS validation (error-level)', () => {
    const result = computeFilingReadiness({ ...BASE, withholdingInvalidCount: 1 })
    expect(result.readyToFile).toBe(false)
    const item = result.items.find((i) => i.code === 'WITHHOLDING_ROWS_VALID')
    expect(item?.ok).toBe(false)
    expect(item?.severity).toBe('error')
  })

  it('blocks when a withheld-tax row has no CPR on file (error-level, mirrors IRIS CPR-before-submit gate)', () => {
    const result = computeFilingReadiness({ ...BASE, withholdingMissingCprCount: 1 })
    expect(result.readyToFile).toBe(false)
    const item = result.items.find((i) => i.code === 'WITHHOLDING_CPR_RECORDED')
    expect(item?.ok).toBe(false)
    expect(item?.severity).toBe('error')
  })
})
