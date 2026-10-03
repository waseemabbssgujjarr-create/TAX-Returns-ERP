import type { RulesBundle } from '@taxdesk/rules'

/**
 * In-memory REVIEWED fixture for unit/golden tests only.
 * Not a production tax-year bundle — TY2025 data remains DRAFT until reviewed.
 *
 * Slabs mirror the illustrative structure used in drafts so engine math can be
 * verified independently of Finance Act sign-off.
 */
export function createReviewedIndividualRulesFixture(taxYear = 2099): RulesBundle {
  const meta = {
    id: `income_tax_individual_${taxYear}_fixture`,
    effectiveFrom: `${taxYear - 1}-07-01`,
    effectiveTo: `${taxYear}-06-30`,
    sourceReference: `TEST FIXTURE ONLY — not Finance Act ${taxYear}`,
    reviewedBy: 'TaxDesk Engine Unit Tests',
    reviewedOn: '2025-01-01',
    version: '1.0.0',
  }

  return {
    taxYear,
    version: '1.0.0',
    index: {
      taxYear,
      version: '1.0.0',
      publishedOn: '2025-01-01',
      reviewedBy: 'TaxDesk Engine Unit Tests',
      sourceFinanceAct: 'TEST FIXTURE — not for production filing',
      files: {
        incomeTax: 'income-tax.json',
        withholding: 'withholding.json',
        deductions: 'deductions.json',
        credits: 'credits.json',
        deadlines: 'deadlines.json',
        goldenCases: 'golden-cases.json',
        penalties: 'penalties.json',
      },
    },
    incomeTax: {
      ...meta,
      slabs: [
        {
          fromPkr: 0,
          toPkr: 600_000,
          fixedTaxPkr: 0,
          marginalRate: 0,
          roundingRule: 'DOWN_RUPEE',
        },
        {
          fromPkr: 600_001,
          toPkr: 1_200_000,
          fixedTaxPkr: 0,
          marginalRate: 0.05,
          roundingRule: 'DOWN_RUPEE',
        },
        {
          fromPkr: 1_200_001,
          toPkr: 2_400_000,
          fixedTaxPkr: 30_000,
          marginalRate: 0.15,
          roundingRule: 'DOWN_RUPEE',
        },
        {
          fromPkr: 2_400_001,
          toPkr: 3_600_000,
          fixedTaxPkr: 210_000,
          marginalRate: 0.25,
          roundingRule: 'DOWN_RUPEE',
        },
        {
          fromPkr: 3_600_001,
          toPkr: 6_000_000,
          fixedTaxPkr: 510_000,
          marginalRate: 0.3,
          roundingRule: 'DOWN_RUPEE',
        },
        {
          fromPkr: 6_000_001,
          toPkr: null,
          fixedTaxPkr: 1_230_000,
          marginalRate: 0.35,
          roundingRule: 'DOWN_RUPEE',
        },
      ],
      superTaxSlabs: null,
    },
    withholding: {
      ...meta,
      id: `withholding_${taxYear}_fixture`,
      rates: [
        {
          section: '149',
          description: 'Salary (fixture)',
          filerRate: 0,
          nonFilerRate: 0,
          isAdjustable: true,
          thresholdPkr: null,
        },
      ],
    },
    deductions: {
      ...meta,
      id: `deductions_${taxYear}_fixture`,
      deductions: [],
    },
    credits: {
      ...meta,
      id: `credits_${taxYear}_fixture`,
      credits: [],
    },
    deadlines: {
      ...meta,
      id: `deadlines_${taxYear}_fixture`,
      deadlines: [],
    },
    penalties: {
      ...meta,
      id: `penalties_${taxYear}_fixture`,
      lateFilingPenalty: {
        id: `late_filing_penalty_${taxYear}_fixture`,
        perDayPkr: 1000,
        percentOfTaxPayablePerDay: 0.001,
        useGreaterOf: true,
        capPercentOfTaxPayable: 0.5,
        minimumPkr: { individualSalaried: 10000, other: 50000 },
        reductionTiers: [
          { withinMonths: 1, reductionRate: 0.75 },
          { withinMonths: 2, reductionRate: 0.5 },
          { withinMonths: 3, reductionRate: 0.25 },
        ],
        section: '182 (fixture)',
      },
      atlSurcharge: {
        id: `atl_surcharge_${taxYear}_fixture`,
        amountPkr: { individual: 25000, aop: 50000, company: 100000 },
        section: '182A (fixture)',
      },
    },
  }
}

export function createDraftRulesFixture(taxYear = 2025): RulesBundle {
  const reviewed = createReviewedIndividualRulesFixture(taxYear)
  return {
    ...reviewed,
    version: '0.1.0-DRAFT',
    index: {
      ...reviewed.index,
      version: '0.1.0',
      reviewedBy: 'PENDING — DRAFT PLACEHOLDER',
      sourceFinanceAct: 'Finance Act PLACEHOLDER',
    },
    incomeTax: {
      ...reviewed.incomeTax,
      version: '0.1.0',
      reviewedBy: 'PENDING',
      sourceReference: 'PLACEHOLDER — not verified',
    },
  }
}
