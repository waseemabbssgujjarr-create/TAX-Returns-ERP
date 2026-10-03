import { describe, expect, it } from 'vitest'

import { compute, isDraftOrPlaceholderRules } from './compute'
import {
  createDraftRulesFixture,
  createReviewedIndividualRulesFixture,
} from './fixtures/reviewedRules'
import { computeProgressiveSlabTaxPaisa, pkrToPaisa, roundDownToRupeePaisa } from './slabs'
import type { TaxInputs } from './types'

function salaryInputs(taxYear: number, grossSalaryPaisa: bigint): TaxInputs {
  return {
    taxYear,
    clientType: 'INDIVIDUAL',
    filerStatus: 'FILER',
    residencyStatus: 'RESIDENT',
    income: [
      {
        head: 'SALARY',
        grossSalary: grossSalaryPaisa,
        allowances: {},
        perquisites: 0n,
        bonus: 0n,
        providentFund: 0n,
        taxDeducted: 0n,
        evidenceIds: [],
      },
    ],
    deductions: [],
    credits: [],
    withholding: [],
  }
}

describe('computeProgressiveSlabTaxPaisa', () => {
  const rules = createReviewedIndividualRulesFixture(2099)

  it('zero income → zero tax', () => {
    const r = computeProgressiveSlabTaxPaisa(0n, rules.incomeTax.slabs, rules.incomeTax.id)
    expect(r.isOk()).toBe(true)
    if (r.isOk()) expect(r.value.grossTaxPaisa).toBe(0n)
  })

  it('nil slab boundary 600_000 PKR → 0 tax', () => {
    const r = computeProgressiveSlabTaxPaisa(
      pkrToPaisa(600_000),
      rules.incomeTax.slabs,
      rules.incomeTax.id,
    )
    expect(r.isOk()).toBe(true)
    if (r.isOk()) expect(r.value.grossTaxPaisa).toBe(0n)
  })

  it('slab transition at 1_200_000 PKR → 30_000 PKR tax', () => {
    const r = computeProgressiveSlabTaxPaisa(
      pkrToPaisa(1_200_000),
      rules.incomeTax.slabs,
      rules.incomeTax.id,
    )
    expect(r.isOk()).toBe(true)
    if (r.isOk()) expect(r.value.grossTaxPaisa).toBe(pkrToPaisa(30_000))
  })

  it('just into third slab 1_200_001 → fixed 30_000 + 15% of 1', () => {
    const r = computeProgressiveSlabTaxPaisa(
      pkrToPaisa(1_200_001),
      rules.incomeTax.slabs,
      rules.incomeTax.id,
    )
    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      // excess = 1_200_001 - 1_200_000 = 1; 0.15 PKR → round DOWN to 0 paisa on marginal
      // fixed 30000 → total 30000 PKR
      expect(r.value.grossTaxPaisa).toBe(pkrToPaisa(30_000))
    }
  })

  it('highest open slab applies above 6_000_000', () => {
    const r = computeProgressiveSlabTaxPaisa(
      pkrToPaisa(7_000_000),
      rules.incomeTax.slabs,
      rules.incomeTax.id,
    )
    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      // fixed 1_230_000 + 35% of (7_000_000 - 6_000_000) = 1_230_000 + 350_000 = 1_580_000
      expect(r.value.grossTaxPaisa).toBe(pkrToPaisa(1_580_000))
    }
  })

  it('empty slabs → RULES_VALIDATION_FAILED', () => {
    const r = computeProgressiveSlabTaxPaisa(pkrToPaisa(1000), [], 'x')
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error.code).toBe('RULES_VALIDATION_FAILED')
  })

  it('negative income → COMPUTATION_ERROR', () => {
    const r = computeProgressiveSlabTaxPaisa(-100n, rules.incomeTax.slabs, 'x')
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error.code).toBe('COMPUTATION_ERROR')
  })

  it('DOWN_RUPEE rounds fractional paisa down', () => {
    expect(roundDownToRupeePaisa(199n)).toBe(100n)
    expect(roundDownToRupeePaisa(100n)).toBe(100n)
    expect(roundDownToRupeePaisa(1n)).toBe(0n)
  })
})

describe('compute()', () => {
  const taxYear = 2099
  const rules = createReviewedIndividualRulesFixture(taxYear)

  it('rejects tax-year mismatch', () => {
    const r = compute(salaryInputs(2024, pkrToPaisa(600_000)), rules)
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error.code).toBe('RULES_NOT_AVAILABLE')
  })

  it('rejects DRAFT/PLACEHOLDER rules explicitly', () => {
    const draft = createDraftRulesFixture(2025)
    expect(isDraftOrPlaceholderRules(draft)).toBe(true)
    const r = compute(salaryInputs(2025, pkrToPaisa(600_000)), draft)
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error.code).toBe('RULES_DRAFT')
  })

  it('golden-style: 600_000 PKR salary → 0 payable', () => {
    const r = compute(salaryInputs(taxYear, pkrToPaisa(600_000)), rules)
    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      expect(r.value.grossTax).toBe(0n)
      expect(r.value.taxPayable).toBe(0n)
      expect(r.value.rulesVersion).toBe('1.0.0')
    }
  })

  it('golden-style: 1_200_000 PKR salary → 30_000 PKR tax', () => {
    const r = compute(salaryInputs(taxYear, pkrToPaisa(1_200_000)), rules)
    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      expect(r.value.grossTax).toBe(pkrToPaisa(30_000))
      expect(r.value.taxPayable).toBe(pkrToPaisa(30_000))
    }
  })

  it('rejects unsupported client types', () => {
    const inputs = salaryInputs(taxYear, pkrToPaisa(1000))
    inputs.clientType = 'COMPANY'
    const r = compute(inputs, rules)
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error.code).toBe('UNSUPPORTED_CLIENT_TYPE')
  })

  it('missing slabs → validation error', () => {
    const broken = createReviewedIndividualRulesFixture(taxYear)
    broken.incomeTax.slabs = []
    const r = compute(salaryInputs(taxYear, pkrToPaisa(1000)), broken)
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error.code).toBe('RULES_VALIDATION_FAILED')
  })
})
