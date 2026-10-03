import type { RulesBundle } from '@taxdesk/rules'
import { err, ok, type Result } from 'neverthrow'

import { isDraftOrPlaceholderRules } from './compute'
import { TaxEngineError } from './types'

export type PenaltyFilingKind = 'INCOME_TAX_RETURN' | 'ATL_SURCHARGE'
export type PenaltyClientType = 'INDIVIDUAL' | 'AOP' | 'COMPANY'

export interface PenaltyCalculationInputs {
  filingKind: PenaltyFilingKind
  clientType: PenaltyClientType
  /** Tax payable in paisa — the base the s.182 daily/percentage penalty is computed on */
  taxPayablePaisa: bigint
  /** Whole days elapsed since the statutory due date */
  daysLate: number
}

export interface PenaltyCalculationResult {
  penaltyPaisa: bigint
  minimumAppliedPaisa: bigint | null
  cappedAtMax: boolean
  reductionPercentApplied: number | null
  /** i18n keys describing each step applied, in order, for an "explain this number" UI */
  explanationKeys: string[]
}

const BPS_SCALE = 10_000n

function toBps(decimal: number): bigint {
  return BigInt(Math.round(decimal * Number(BPS_SCALE)))
}

/**
 * Pure late-filing / ATL-surcharge penalty calculator.
 *
 * CONTRACT (same as compute()):
 * - Pure function, no I/O, deterministic.
 * - All money in BigInt paisa — never floating point.
 * - Fails closed (RULES_DRAFT) against unreviewed rule packs — never fabricates a figure
 *   a consultant could rely on before the rules have been signed off.
 *
 * Mirrors Income Tax Ordinance 2001 s.182 (late filing), s.182A (ATL surcharge).
 * Every rate/threshold/cap/minimum comes from the versioned rules pack — nothing is
 * hard-coded here.
 */
export function calculateLateFilingPenalty(
  inputs: PenaltyCalculationInputs,
  rules: RulesBundle,
): Result<PenaltyCalculationResult, TaxEngineError> {
  if (isDraftOrPlaceholderRules(rules)) {
    return err(
      new TaxEngineError(
        'RULES_DRAFT',
        `Penalty rules for TY${rules.taxYear} (version ${rules.version}) are DRAFT/PLACEHOLDER ` +
          `and have not been professionally reviewed. Penalty estimate is blocked.`,
      ),
    )
  }

  const explanationKeys: string[] = []

  if (inputs.filingKind === 'ATL_SURCHARGE') {
    const { atlSurcharge } = rules.penalties
    const amountPkr =
      inputs.clientType === 'INDIVIDUAL'
        ? atlSurcharge.amountPkr.individual
        : inputs.clientType === 'AOP'
          ? atlSurcharge.amountPkr.aop
          : atlSurcharge.amountPkr.company
    explanationKeys.push('penalty.atlSurcharge.flatAmount')
    return ok({
      penaltyPaisa: BigInt(amountPkr) * 100n,
      minimumAppliedPaisa: null,
      cappedAtMax: false,
      reductionPercentApplied: null,
      explanationKeys,
    })
  }

  const rule = rules.penalties.lateFilingPenalty

  if (inputs.daysLate <= 0) {
    explanationKeys.push('penalty.lateFiling.notLate')
    return ok({
      penaltyPaisa: 0n,
      minimumAppliedPaisa: null,
      cappedAtMax: false,
      reductionPercentApplied: null,
      explanationKeys,
    })
  }

  const daysLate = BigInt(inputs.daysLate)
  const perDayPaisa = BigInt(rule.perDayPkr) * 100n
  const dailyFlat = perDayPaisa * daysLate

  const percentBps = toBps(rule.percentOfTaxPayablePerDay)
  const dailyPercent = ((inputs.taxPayablePaisa * percentBps) / BPS_SCALE) * daysLate

  let base: bigint
  if (rule.useGreaterOf) {
    base = dailyFlat > dailyPercent ? dailyFlat : dailyPercent
    explanationKeys.push(
      dailyFlat > dailyPercent ? 'penalty.lateFiling.perDayGreater' : 'penalty.lateFiling.percentGreater',
    )
  } else {
    base = dailyFlat + dailyPercent
    explanationKeys.push('penalty.lateFiling.sumOfBoth')
  }

  const capBps = toBps(rule.capPercentOfTaxPayable)
  const capPaisa = (inputs.taxPayablePaisa * capBps) / BPS_SCALE
  const cappedAtMax = base > capPaisa
  const afterCap = cappedAtMax ? capPaisa : base
  if (cappedAtMax) explanationKeys.push('penalty.lateFiling.capped')

  const minimumPkr =
    inputs.clientType === 'INDIVIDUAL' ? rule.minimumPkr.individualSalaried : rule.minimumPkr.other
  const minimumPaisa = BigInt(minimumPkr) * 100n
  const minimumApplied = afterCap < minimumPaisa
  const afterMinimum = minimumApplied ? minimumPaisa : afterCap
  if (minimumApplied) explanationKeys.push('penalty.lateFiling.minimumApplied')

  const monthsLate = Math.ceil(inputs.daysLate / 30)
  const tier = [...rule.reductionTiers]
    .sort((a, b) => a.withinMonths - b.withinMonths)
    .find((t) => monthsLate <= t.withinMonths)
  const reductionRate = tier?.reductionRate ?? 0
  const reductionBps = toBps(reductionRate)
  const finalPenalty = afterMinimum - (afterMinimum * reductionBps) / BPS_SCALE
  if (tier) explanationKeys.push('penalty.lateFiling.reductionApplied')

  return ok({
    penaltyPaisa: finalPenalty,
    minimumAppliedPaisa: minimumApplied ? minimumPaisa : null,
    cappedAtMax,
    reductionPercentApplied: tier ? reductionRate : null,
    explanationKeys,
  })
}
