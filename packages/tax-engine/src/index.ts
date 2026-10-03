/**
 * @taxdesk/tax-engine
 *
 * Pure TypeScript tax computation engine.
 * No I/O. No side effects. 100% deterministic.
 *
 * Usage:
 *   import { compute, isDraftOrPlaceholderRules } from '@taxdesk/tax-engine'
 *   import { loadRules } from '@taxdesk/rules'
 *
 *   const rules = loadRules(2025)
 *   const result = compute(inputs, rules)
 */

export { compute, isDraftOrPlaceholderRules } from './compute'

export type {
  TaxInputs,
  ComputationResult,
  ExplanationNode,
  IncomeEntry,
  SalaryIncome,
  BusinessIncome,
  PropertyIncome,
  OtherSourcesIncome,
  DeductionEntry,
  TaxCreditEntry,
  WithholdingEntry,
  TaxYear,
  EngineErrorCode,
} from './types'

export { TaxEngineError } from './types'

export {
  computeProgressiveSlabTaxPaisa,
  pkrToPaisa,
  paisaToPkrFloor,
  roundDownToRupeePaisa,
} from './slabs'

export {
  createReviewedIndividualRulesFixture,
  createDraftRulesFixture,
} from './fixtures/reviewedRules'

export { formatPKR } from './format'

export { calculateLateFilingPenalty } from './penalty'

export type {
  PenaltyFilingKind,
  PenaltyClientType,
  PenaltyCalculationInputs,
  PenaltyCalculationResult,
} from './penalty'
