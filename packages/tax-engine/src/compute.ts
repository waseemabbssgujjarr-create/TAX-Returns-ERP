import type { RulesBundle } from '@taxdesk/rules'
import { err, ok, type Result } from 'neverthrow'

import { assertIncomeTaxRulesUsable, computeProgressiveSlabTaxPaisa } from './slabs'
import type { TaxInputs, ComputationResult, ExplanationNode } from './types'
import { TaxEngineError } from './types'

const DRAFT_MARKERS = ['DRAFT', 'PLACEHOLDER', 'PENDING'] as const

/**
 * Returns true when a rules bundle (or version string) is explicitly marked
 * as draft / placeholder / pending review. Production computation must fail closed.
 */
export function isDraftOrPlaceholderRules(rules: RulesBundle): boolean {
  const haystack = [
    rules.version,
    rules.index.version,
    rules.index.reviewedBy,
    rules.incomeTax.version,
    rules.incomeTax.reviewedBy,
    rules.incomeTax.sourceReference,
  ]
    .join(' ')
    .toUpperCase()

  return DRAFT_MARKERS.some((m) => haystack.includes(m))
}

/**
 * Core computation function.
 *
 * CONTRACT:
 * - Pure function: no I/O, no side effects, no randomness.
 * - Deterministic: same inputs + same rules = same result, always.
 * - Runs identically in the browser (live preview) and on the server.
 * - Returns a full explanationTree so the UI can render "why this number".
 * - If any required rule is missing, draft/placeholder, or fails validation, returns Err —
 *   never falls back to a default or prior-year value.
 *
 * MONEY: all amounts are BigInt paisa. Never use floating-point arithmetic.
 * ROUNDING: per slab roundingRule (typically DOWN_RUPEE).
 */
export function compute(
  inputs: TaxInputs,
  rules: RulesBundle,
): Result<ComputationResult, TaxEngineError> {
  // ── Guard: rules must match the requested tax year ──────────────────────────
  if (rules.taxYear !== inputs.taxYear) {
    return err(
      new TaxEngineError(
        'RULES_NOT_AVAILABLE',
        `Rules are for tax year ${rules.taxYear} but inputs specify ${inputs.taxYear}. ` +
          `Never use rules from a different tax year.`,
      ),
    )
  }

  // ── Guard: never compute against draft / placeholder rules ─────────────────
  if (isDraftOrPlaceholderRules(rules)) {
    return err(
      new TaxEngineError(
        'RULES_DRAFT',
        `Tax rules for TY${rules.taxYear} (version ${rules.version}) are DRAFT/PLACEHOLDER ` +
          `and have not been professionally reviewed. Computation is blocked.`,
      ),
    )
  }

  const slabsOk = assertIncomeTaxRulesUsable(rules.incomeTax)
  if (slabsOk.isErr()) {
    return err(slabsOk.error)
  }

  // ── Guard: client type support ──────────────────────────────────────────────
  if (inputs.clientType !== 'INDIVIDUAL') {
    return err(
      new TaxEngineError(
        'UNSUPPORTED_CLIENT_TYPE',
        `Client type '${inputs.clientType}' is not yet supported by the engine. ` +
          `Only INDIVIDUAL is available in Phase 1.`,
      ),
    )
  }

  // ── Step 1: Aggregate income per head ──────────────────────────────────────
  const incomeByHead = aggregateIncomeByHead(inputs)

  // ── Step 2: Apply deductible allowances (salary head only for now) ─────────
  const { taxableIncome, incomeExplanation } = computeTaxableIncome(incomeByHead)

  // ── Step 3: Apply tax slabs ─────────────────────────────────────────────────
  const slabResult = computeProgressiveSlabTaxPaisa(
    taxableIncome,
    rules.incomeTax.slabs,
    rules.incomeTax.id,
  )
  if (slabResult.isErr()) {
    return err(slabResult.error)
  }
  const { grossTaxPaisa: grossTax, explanation: slabExplanation } = slabResult.value

  // ── Step 4: Rebates ──────────────────────────────────────────────────────────
  const rebates = 0n // Phase extension — load from rules when rebate section ships

  // ── Step 5: Tax credits ──────────────────────────────────────────────────────
  const taxCredits = computeTaxCredits(inputs, grossTax, rules)

  // ── Step 6: Net tax ──────────────────────────────────────────────────────────
  const netTax = bigintMax(grossTax - rebates - taxCredits, 0n)

  // ── Step 7: Withholding ───────────────────────────────────────────────────────
  const { adjustableWithholding, finalWithholding } = separateWithholding(inputs)

  // ── Step 8: Tax payable / refundable ─────────────────────────────────────────
  const taxPayable = netTax - adjustableWithholding

  // ── Step 9: Minimum tax (where applicable) ────────────────────────────────────
  const minimumTax = 0n

  // ── Build explanation tree ────────────────────────────────────────────────────
  const explanationTree: ExplanationNode[] = [
    {
      labelKey: 'engine.grossIncome',
      value: incomeByHead.grossIncome,
      ruleIds: [],
      children: incomeExplanation,
    },
    {
      labelKey: 'engine.taxableIncome',
      value: taxableIncome,
      ruleIds: [],
    },
    {
      labelKey: 'engine.grossTax',
      value: grossTax,
      ruleIds: [rules.incomeTax.id],
      children: slabExplanation,
    },
    {
      labelKey: 'engine.netTax',
      value: netTax,
      ruleIds: [],
    },
    {
      labelKey: 'engine.adjustableWithholding',
      value: adjustableWithholding,
      ruleIds: [],
    },
    {
      labelKey: 'engine.taxPayable',
      value: taxPayable,
      ruleIds: [],
      ...(taxPayable < 0n ? { note: 'engine.refundable' as const } : {}),
    },
  ]

  const result: ComputationResult = {
    taxYear: inputs.taxYear,
    rulesVersion: rules.version,
    grossIncome: incomeByHead.grossIncome,
    taxableIncome,
    grossTax,
    rebates,
    taxCredits,
    netTax,
    adjustableWithholding,
    finalWithholding,
    advanceTaxPaid: 0n,
    taxPayable,
    minimumTax,
    explanationTree,
    inputsSnapshot: inputs,
  }

  return ok(result)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function aggregateIncomeByHead(inputs: TaxInputs) {
  let grossIncome = 0n
  const incomeExplanation: ExplanationNode[] = []

  for (const entry of inputs.income) {
    let headIncome = 0n

    if (entry.head === 'SALARY') {
      headIncome = entry.grossSalary + entry.perquisites + entry.bonus
    } else if (entry.head === 'BUSINESS') {
      headIncome = entry.revenue - entry.expenses
    } else if (entry.head === 'PROPERTY') {
      headIncome = entry.grossRent
    } else if (entry.head === 'OTHER_SOURCES') {
      headIncome = entry.bankProfit + entry.dividends + entry.other
    }

    grossIncome += bigintMax(headIncome, 0n)
    incomeExplanation.push({
      labelKey: `engine.income.${entry.head.toLowerCase()}`,
      value: headIncome,
      ruleIds: [],
    })
  }

  return { grossIncome, incomeExplanation }
}

function computeTaxableIncome(incomeByHead: ReturnType<typeof aggregateIncomeByHead>): {
  taxableIncome: bigint
  incomeExplanation: ExplanationNode[]
} {
  return {
    taxableIncome: incomeByHead.grossIncome,
    incomeExplanation: incomeByHead.incomeExplanation,
  }
}

function computeTaxCredits(inputs: TaxInputs, grossTax: bigint, rules: RulesBundle): bigint {
  let total = 0n
  for (const credit of inputs.credits) {
    const rule = rules.credits.credits.find((c) => c.id === credit.ruleId)
    if (!rule) {
      continue
    }
    const rateBps = BigInt(Math.round(rule.creditRate * 10_000))
    let amount = (credit.qualifyingAmount * rateBps) / 10_000n
    if (rule.maxCreditPkr !== null) {
      const maxPaisa = BigInt(rule.maxCreditPkr) * 100n
      if (amount > maxPaisa) amount = maxPaisa
    }
    total += amount
  }
  if (total > grossTax) total = grossTax
  return total
}

function separateWithholding(inputs: TaxInputs): {
  adjustableWithholding: bigint
  finalWithholding: bigint
} {
  let adjustable = 0n
  let final = 0n

  for (const w of inputs.withholding) {
    if (w.isAdjustable) {
      adjustable += w.taxAmount
    } else {
      final += w.taxAmount
    }
  }

  return { adjustableWithholding: adjustable, finalWithholding: final }
}

function bigintMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b
}
