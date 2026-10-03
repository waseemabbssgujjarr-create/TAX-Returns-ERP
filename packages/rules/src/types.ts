import type {
  IncomeTaxRules,
  WithholdingRules,
  DeductionsRules,
  CreditsRules,
  DeadlinesRules,
  PenaltyRules,
  RulesIndex,
} from './schema'

/**
 * A fully loaded and validated rules bundle for one tax year.
 * This is the object passed to compute() in the tax engine.
 */
export interface RulesBundle {
  taxYear: number
  version: string
  index: RulesIndex
  incomeTax: IncomeTaxRules
  withholding: WithholdingRules
  deductions: DeductionsRules
  credits: CreditsRules
  deadlines: DeadlinesRules
  penalties: PenaltyRules
}

/** Error thrown when rules cannot be loaded or fail validation */
export class RulesLoadError extends Error {
  constructor(
    public readonly taxYear: number,
    message: string,
  ) {
    super(`[Rules TY${taxYear}] ${message}`)
    this.name = 'RulesLoadError'
  }
}
