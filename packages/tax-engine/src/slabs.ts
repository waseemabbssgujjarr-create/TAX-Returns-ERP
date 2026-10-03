/**
 * Tax slab / progressive computation helpers.
 * Pure — no I/O. All money in BigInt paisa (1 PKR = 100 paisa).
 */

import type { IncomeTaxRules, SlabEntry } from '@taxdesk/rules'
import { err, ok, type Result } from 'neverthrow'

import { TaxEngineError, type ExplanationNode } from './types'

const PAISA_PER_PKR = 100n

export function pkrToPaisa(pkr: number): bigint {
  return BigInt(Math.trunc(pkr)) * PAISA_PER_PKR
}

export function paisaToPkrFloor(paisa: bigint): bigint {
  return paisa >= 0n ? paisa / PAISA_PER_PKR : -(-paisa / PAISA_PER_PKR)
}

/** Round paisa amount down to whole-rupee boundary (DOWN_RUPEE). */
export function roundDownToRupeePaisa(paisa: bigint): bigint {
  if (paisa >= 0n) {
    return (paisa / PAISA_PER_PKR) * PAISA_PER_PKR
  }
  // Negative: toward −∞ in rupee steps
  const abs = -paisa
  return -((abs + PAISA_PER_PKR - 1n) / PAISA_PER_PKR) * PAISA_PER_PKR
}

/**
 * Pakistani progressive slabs (Finance Act style):
 * taxPkr = fixedTaxPkr + (taxableIncomePkr − (fromPkr − 1)) × marginalRate
 * when taxableIncomePkr is within [fromPkr, toPkr] (toPkr null = open-ended).
 */
export function computeProgressiveSlabTaxPaisa(
  taxableIncomePaisa: bigint,
  slabs: SlabEntry[],
  ruleId: string,
): Result<{ grossTaxPaisa: bigint; explanation: ExplanationNode[] }, TaxEngineError> {
  if (slabs.length === 0) {
    return err(
      new TaxEngineError(
        'RULES_VALIDATION_FAILED',
        'Income tax slabs array is empty — cannot compute tax.',
      ),
    )
  }

  if (taxableIncomePaisa < 0n) {
    return err(
      new TaxEngineError(
        'COMPUTATION_ERROR',
        'Taxable income cannot be negative for slab computation.',
      ),
    )
  }

  // Zero income → zero tax without selecting a slab
  if (taxableIncomePaisa === 0n) {
    return ok({
      grossTaxPaisa: 0n,
      explanation: [
        {
          labelKey: 'engine.slabs.zeroIncome',
          value: 0n,
          ruleIds: [ruleId],
        },
      ],
    })
  }

  const taxableIncomePkr = paisaToPkrFloor(taxableIncomePaisa)
  const taxableIncomePkrNumber = Number(taxableIncomePkr)
  if (!Number.isSafeInteger(taxableIncomePkrNumber)) {
    return err(
      new TaxEngineError(
        'COMPUTATION_ERROR',
        'Taxable income exceeds safe integer range for slab lookup.',
      ),
    )
  }

  const sorted = [...slabs].sort((a, b) => a.fromPkr - b.fromPkr)
  const slab = sorted.find((s) => {
    const atOrAbove = taxableIncomePkrNumber >= s.fromPkr
    const atOrBelow = s.toPkr === null || taxableIncomePkrNumber <= s.toPkr
    return atOrAbove && atOrBelow
  })

  if (!slab) {
    return err(
      new TaxEngineError(
        'RULES_VALIDATION_FAILED',
        `No income-tax slab covers taxable income of ${taxableIncomePkr} PKR.`,
      ),
    )
  }

  // excess = income − (fromPkr − 1); for fromPkr=0, excess = income
  const lowerExclusiveBound = BigInt(Math.max(slab.fromPkr - 1, 0))
  const excessPkr = taxableIncomePkr - lowerExclusiveBound
  if (excessPkr < 0n) {
    return err(
      new TaxEngineError('COMPUTATION_ERROR', 'Slab excess calculation produced a negative value.'),
    )
  }

  // tax = fixed + excess × rate  (compute in paisa with rational rate)
  // rate is decimal 0..1 — use basis points (rate * 10000) for precision
  const rateBps = BigInt(Math.round(slab.marginalRate * 10_000))
  const fixedPaisa = pkrToPaisa(slab.fixedTaxPkr)
  const excessPaisa = excessPkr * PAISA_PER_PKR
  // (excessPaisa * rateBps) / 10000
  let marginalTaxPaisa = (excessPaisa * rateBps) / 10_000n

  let grossTaxPaisa = fixedPaisa + marginalTaxPaisa

  if (slab.roundingRule === 'DOWN_RUPEE') {
    grossTaxPaisa = roundDownToRupeePaisa(grossTaxPaisa)
    marginalTaxPaisa = roundDownToRupeePaisa(marginalTaxPaisa)
  } else if (slab.roundingRule === 'NEAREST_RUPEE') {
    const half = PAISA_PER_PKR / 2n
    grossTaxPaisa = ((grossTaxPaisa + half) / PAISA_PER_PKR) * PAISA_PER_PKR
  }

  const explanation: ExplanationNode[] = [
    {
      labelKey: 'engine.slabs.selected',
      value: grossTaxPaisa,
      ruleIds: [ruleId],
      note: `fromPkr=${slab.fromPkr};toPkr=${slab.toPkr ?? 'open'};rate=${slab.marginalRate};fixedPkr=${slab.fixedTaxPkr}`,
      children: [
        {
          labelKey: 'engine.slabs.fixedComponent',
          value: fixedPaisa,
          ruleIds: [ruleId],
        },
        {
          labelKey: 'engine.slabs.marginalComponent',
          value: marginalTaxPaisa,
          ruleIds: [ruleId],
        },
      ],
    },
  ]

  return ok({ grossTaxPaisa, explanation })
}

export function assertIncomeTaxRulesUsable(
  incomeTax: IncomeTaxRules,
): Result<void, TaxEngineError> {
  if (!incomeTax.slabs?.length) {
    return err(new TaxEngineError('RULES_VALIDATION_FAILED', 'Income tax rules have no slabs.'))
  }
  return ok(undefined)
}
