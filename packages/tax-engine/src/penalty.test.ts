import { describe, expect, it } from 'vitest'

import { createDraftRulesFixture, createReviewedIndividualRulesFixture } from './fixtures/reviewedRules'
import { calculateLateFilingPenalty } from './penalty'

describe('calculateLateFilingPenalty', () => {
  const rules = createReviewedIndividualRulesFixture(2099)

  it('blocks against DRAFT/placeholder rules (fail-closed, mirrors compute())', () => {
    const draft = createDraftRulesFixture(2025)
    const result = calculateLateFilingPenalty(
      {
        filingKind: 'INCOME_TAX_RETURN',
        clientType: 'INDIVIDUAL',
        taxPayablePaisa: 20_000_000n,
        daysLate: 20,
      },
      draft,
    )
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('RULES_DRAFT')
    }
  })

  it('acceptance case: Rs 200,000 tax payable, 20 days late (within 1 month → 75% reduction)', () => {
    // Hand check against the fixture rule pack (perDayPkr=1000, percentPerDay=0.1%, useGreaterOf):
    //   dailyFlat    = Rs 1,000/day × 20 days = Rs 20,000
    //   dailyPercent = 0.1% × Rs 200,000 × 20 days = Rs 4,000
    //   base         = max(20,000, 4,000) = Rs 20,000 (perDayPkr is greater)
    //   cap          = 50% × Rs 200,000 = Rs 100,000 → not capped
    //   minimum      = Rs 10,000 (individual) → 20,000 already exceeds it
    //   monthsLate   = ceil(20/30) = 1 → within-1-month tier → 75% reduction
    //   final        = 20,000 × (1 − 0.75) = Rs 5,000
    const result = calculateLateFilingPenalty(
      {
        filingKind: 'INCOME_TAX_RETURN',
        clientType: 'INDIVIDUAL',
        taxPayablePaisa: 20_000_000n, // Rs 200,000
        daysLate: 20,
      },
      rules,
    )
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.penaltyPaisa).toBe(500_000n) // Rs 5,000
      expect(result.value.cappedAtMax).toBe(false)
      expect(result.value.minimumAppliedPaisa).toBeNull()
      expect(result.value.reductionPercentApplied).toBe(0.75)
    }
  })

  it('applies the minimum penalty floor when the computed amount is below it', () => {
    const result = calculateLateFilingPenalty(
      {
        filingKind: 'INCOME_TAX_RETURN',
        clientType: 'COMPANY',
        taxPayablePaisa: 100_000n, // Rs 1,000 — tiny tax payable
        daysLate: 95, // beyond all reduction tiers
      },
      rules,
    )
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      // "other" minimum = Rs 50,000 → floor applies since the daily computation is negligible
      expect(result.value.minimumAppliedPaisa).toBe(5_000_000n)
      expect(result.value.penaltyPaisa).toBe(5_000_000n)
      expect(result.value.reductionPercentApplied).toBeNull()
    }
  })

  it('caps the penalty at the configured percentage of tax payable', () => {
    const result = calculateLateFilingPenalty(
      {
        filingKind: 'INCOME_TAX_RETURN',
        clientType: 'INDIVIDUAL',
        taxPayablePaisa: 10_000_000n, // Rs 100,000
        daysLate: 400, // far beyond reduction tiers — tests the cap, not the floor
      },
      rules,
    )
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.cappedAtMax).toBe(true)
      expect(result.value.penaltyPaisa).toBe(5_000_000n) // 50% of Rs 100,000
    }
  })

  it('ATL surcharge is a flat per-client-type amount, independent of days late', () => {
    const result = calculateLateFilingPenalty(
      {
        filingKind: 'ATL_SURCHARGE',
        clientType: 'AOP',
        taxPayablePaisa: 0n,
        daysLate: 0,
      },
      rules,
    )
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.penaltyPaisa).toBe(5_000_000n) // Rs 50,000
    }
  })

  it('returns zero penalty when not late', () => {
    const result = calculateLateFilingPenalty(
      {
        filingKind: 'INCOME_TAX_RETURN',
        clientType: 'INDIVIDUAL',
        taxPayablePaisa: 20_000_000n,
        daysLate: 0,
      },
      rules,
    )
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.penaltyPaisa).toBe(0n)
    }
  })
})
