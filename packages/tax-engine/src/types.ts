/**
 * Core types for the TaxDesk PK computation engine.
 *
 * All monetary amounts are BigInt paisa (1 PKR = 100 paisa).
 * Never use `number` for money.
 */

// ── Tax year ─────────────────────────────────────────────────────────────────

/** Tax year as a calendar year integer (e.g. 2025 = TY ending 30 June 2025) */
export type TaxYear = number

// ── Income ───────────────────────────────────────────────────────────────────

export type IncomeHead =
  | 'SALARY'
  | 'BUSINESS'
  | 'PROPERTY'
  | 'CAPITAL_GAINS'
  | 'OTHER_SOURCES'
  | 'FOREIGN_INCOME'

export interface SalaryIncome {
  head: 'SALARY'
  /** Gross salary in paisa */
  grossSalary: bigint
  /** Allowances broken down — keys are allowance type codes */
  allowances: Record<string, bigint>
  /** Benefits/perquisites in paisa */
  perquisites: bigint
  /** Bonus in paisa */
  bonus: bigint
  /** Provident fund contributions (employer + employee) in paisa */
  providentFund: bigint
  /** Tax already deducted by employer in paisa */
  taxDeducted: bigint
  /** Evidence document IDs */
  evidenceIds: string[]
}

export interface BusinessIncome {
  head: 'BUSINESS'
  /** Net revenue from business in paisa */
  revenue: bigint
  /** Allowable business expenses in paisa */
  expenses: bigint
  /** Depreciation claimed in paisa */
  depreciation: bigint
  /** Tax already deducted (withholding) in paisa */
  taxDeducted: bigint
  evidenceIds: string[]
}

export interface PropertyIncome {
  head: 'PROPERTY'
  /** Annual rent received in paisa */
  grossRent: bigint
  /** Property management expenses (per rules) in paisa */
  expenses: bigint
  /** Tax already deducted in paisa */
  taxDeducted: bigint
  evidenceIds: string[]
}

export interface OtherSourcesIncome {
  head: 'OTHER_SOURCES'
  /** Bank profit in paisa */
  bankProfit: bigint
  /** Dividends in paisa */
  dividends: bigint
  /** Other amounts in paisa */
  other: bigint
  taxDeducted: bigint
  evidenceIds: string[]
}

export type IncomeEntry = SalaryIncome | BusinessIncome | PropertyIncome | OtherSourcesIncome

// ── Deductions & Credits ──────────────────────────────────────────────────────

export interface DeductionEntry {
  /** Rule ID from the rules library */
  ruleId: string
  /** Amount claimed in paisa */
  amount: bigint
  /** Eligibility checklist — each key maps to a boolean answer */
  eligibilityAnswers: Record<string, boolean>
  evidenceIds: string[]
}

export interface TaxCreditEntry {
  /** Rule ID from the rules library */
  ruleId: string
  /** Investment/expenditure amount that qualifies for the credit, in paisa */
  qualifyingAmount: bigint
  evidenceIds: string[]
}

// ── Withholding ───────────────────────────────────────────────────────────────

export interface WithholdingEntry {
  /** Section of the Income Tax Ordinance (loaded from rules, not hard-coded here) */
  section: string
  /** Gross amount on which tax was deducted, in paisa */
  grossAmount: bigint
  /** Tax deducted/collected in paisa */
  taxAmount: bigint
  /** Whether adjustable (true) or final (false) per rules */
  isAdjustable: boolean
  payer: string
  evidenceIds: string[]
}

// ── Computation Inputs ────────────────────────────────────────────────────────

export interface TaxInputs {
  taxYear: TaxYear
  clientType: 'INDIVIDUAL' | 'AOP' | 'COMPANY'
  filerStatus: 'FILER' | 'NON_FILER'
  residencyStatus: 'RESIDENT' | 'NON_RESIDENT'
  income: IncomeEntry[]
  deductions: DeductionEntry[]
  credits: TaxCreditEntry[]
  withholding: WithholdingEntry[]
}

// ── Explanation Tree ──────────────────────────────────────────────────────────

/**
 * Every node in the explanation tree links back to:
 * - The rule ID(s) that produced this figure
 * - The input values used
 * - A human-readable label (i18n key)
 */
export interface ExplanationNode {
  labelKey: string // i18n key for display
  value: bigint // amount in paisa
  ruleIds: string[] // rule IDs from the rules library
  children?: ExplanationNode[] // breakdown
  note?: string // optional extra context
}

// ── Computation Result ────────────────────────────────────────────────────────

export interface ComputationResult {
  taxYear: TaxYear
  rulesVersion: string

  // Key figures — all in paisa
  grossIncome: bigint
  taxableIncome: bigint
  grossTax: bigint
  rebates: bigint
  taxCredits: bigint
  netTax: bigint
  adjustableWithholding: bigint
  finalWithholding: bigint
  advanceTaxPaid: bigint
  taxPayable: bigint // positive = owe, negative = refund
  minimumTax: bigint // where applicable per rules

  /** Full breakdown for the "Explain this number" UI */
  explanationTree: ExplanationNode[]

  /** Snapshot of inputs used — for audit and reproducibility */
  inputsSnapshot: TaxInputs
}

// ── Engine Error ──────────────────────────────────────────────────────────────

export type EngineErrorCode =
  | 'RULES_NOT_AVAILABLE'
  | 'RULES_DRAFT'
  | 'RULES_VALIDATION_FAILED'
  | 'UNSUPPORTED_CLIENT_TYPE'
  | 'MISSING_REQUIRED_INPUT'
  | 'COMPUTATION_ERROR'

export class TaxEngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'TaxEngineError'
  }
}
