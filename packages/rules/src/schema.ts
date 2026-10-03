import { z } from 'zod'

/**
 * Zod schemas for the tax rules data files.
 * Every rule entry must satisfy these schemas — validated at load time.
 *
 * IMPORTANT: Adding fields here may require updating golden-cases.json files.
 * Breaking schema changes require a new tax year directory, not in-place edits.
 */

// ── Shared metadata required on every rule entry ─────────────────────────────

export const RuleMetaSchema = z.object({
  id: z.string().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD'),
  sourceReference: z.string().min(1, 'Must cite source e.g. Finance Act 2025, Second Schedule'),
  reviewedBy: z.string().min(1, 'Must name the tax professional who reviewed this entry'),
  reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver e.g. 1.0.0'),
})

// ── Income tax slab entry ─────────────────────────────────────────────────────

export const SlabEntrySchema = z.object({
  /** Lower bound of the slab in PKR (integer, not paisa) */
  fromPkr: z.number().int().nonnegative(),
  /** Upper bound of the slab in PKR; null means "and above" */
  toPkr: z.number().int().positive().nullable(),
  /** Fixed tax amount in PKR for the lower bound */
  fixedTaxPkr: z.number().int().nonnegative(),
  /** Marginal rate as a decimal e.g. 0.20 for 20% */
  marginalRate: z.number().min(0).max(1),
  /** Rounding rule for this slab */
  roundingRule: z.enum(['DOWN_RUPEE', 'NEAREST_RUPEE', 'NONE']).default('DOWN_RUPEE'),
})

export const IncomeTaxRulesSchema = RuleMetaSchema.extend({
  slabs: z.array(SlabEntrySchema).min(1),
  /** Surcharge / super-tax if applicable — null if not applicable this year */
  superTaxSlabs: z.array(SlabEntrySchema).nullable(),
})

// ── Withholding rate entry ────────────────────────────────────────────────────

export const WithholdingRateSchema = z.object({
  section: z.string().min(1),
  description: z.string(),
  /** Rate for filers as decimal */
  filerRate: z.number().min(0).max(1),
  /** Rate for non-filers as decimal */
  nonFilerRate: z.number().min(0).max(1),
  /** Whether this withholding is adjustable (true) or final (false) */
  isAdjustable: z.boolean(),
  /** Minimum threshold in PKR below which withholding does not apply; null = always applies */
  thresholdPkr: z.number().int().nonnegative().nullable(),
})

export const WithholdingRulesSchema = RuleMetaSchema.extend({
  rates: z.array(WithholdingRateSchema).min(1),
})

// ── Deduction entry ───────────────────────────────────────────────────────────

export const DeductionRuleSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string(),
  /** Maximum deductible amount in PKR; null = unlimited (subject to conditions) */
  maxPkr: z.number().int().nonnegative().nullable(),
  /** Max as a % of taxable income (alternative to or in addition to maxPkr) */
  maxPercentOfIncome: z.number().min(0).max(1).nullable(),
  eligibilityConditions: z.array(z.string()),
  requiredEvidence: z.array(z.string()),
  section: z.string(),
})

export const DeductionsRulesSchema = RuleMetaSchema.extend({
  deductions: z.array(DeductionRuleSchema),
})

// ── Tax credit entry ──────────────────────────────────────────────────────────

export const TaxCreditRuleSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string(),
  /** Credit rate as decimal e.g. 0.20 for 20% of qualifying amount */
  creditRate: z.number().min(0).max(1),
  /** Maximum credit in PKR; null = no cap */
  maxCreditPkr: z.number().int().nonnegative().nullable(),
  eligibilityConditions: z.array(z.string()),
  requiredEvidence: z.array(z.string()),
  section: z.string(),
})

export const CreditsRulesSchema = RuleMetaSchema.extend({
  credits: z.array(TaxCreditRuleSchema),
})

// ── Deadline entry ────────────────────────────────────────────────────────────

export const DeadlineSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string(),
  /** ISO date of the deadline */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Client types this deadline applies to */
  appliesTo: z.array(z.string()),
  description: z.string(),
  penaltyDescription: z.string().optional(),
})

export const DeadlinesRulesSchema = RuleMetaSchema.extend({
  deadlines: z.array(DeadlineSchema),
})

// ── Late-filing / ATL penalty entry (s.182, s.182A, s.34 — Income Tax Ordinance 2001) ──

export const PenaltyReductionTierSchema = z.object({
  /** Filed within this many months of the deadline */
  withinMonths: z.number().int().positive(),
  /** Reduction applied to the computed penalty, as a decimal e.g. 0.75 for 75% off */
  reductionRate: z.number().min(0).max(1),
})

export const LateFilingPenaltyRuleSchema = z.object({
  id: z.string().min(1),
  /** Flat amount per day late, in PKR (0 if the rate is percentage-only) */
  perDayPkr: z.number().int().nonnegative(),
  /** Percentage of tax payable charged per day late, as a decimal e.g. 0.001 for 0.1% */
  percentOfTaxPayablePerDay: z.number().min(0).max(1),
  /** Penalty is the greater of perDayPkr*days or percentOfTaxPayablePerDay*taxPayable*days */
  useGreaterOf: z.boolean(),
  /** Cap as a percentage of tax payable, as a decimal e.g. 0.5 for 50% */
  capPercentOfTaxPayable: z.number().min(0).max(1),
  /** Minimum penalty in PKR by client type */
  minimumPkr: z.object({
    individualSalaried: z.number().int().nonnegative(),
    other: z.number().int().nonnegative(),
  }),
  /** Reduction tiers for filing shortly after the deadline (checked in order) */
  reductionTiers: z.array(PenaltyReductionTierSchema),
  section: z.string().min(1),
})

export const AtlSurchargeRuleSchema = z.object({
  id: z.string().min(1),
  amountPkr: z.object({
    individual: z.number().int().nonnegative(),
    aop: z.number().int().nonnegative(),
    company: z.number().int().nonnegative(),
  }),
  section: z.string().min(1),
})

export const PenaltyRulesSchema = RuleMetaSchema.extend({
  lateFilingPenalty: LateFilingPenaltyRuleSchema,
  atlSurcharge: AtlSurchargeRuleSchema,
})

// ── Master index ──────────────────────────────────────────────────────────────

export const RulesIndexSchema = z.object({
  taxYear: z.number().int().min(2020).max(2099),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reviewedBy: z.string().min(1),
  sourceFinanceAct: z.string().min(1),
  files: z.object({
    incomeTax: z.string(),
    withholding: z.string(),
    deductions: z.string(),
    credits: z.string(),
    deadlines: z.string(),
    goldenCases: z.string(),
    penalties: z.string(),
  }),
})

// ── Inferred types ────────────────────────────────────────────────────────────

export type RulesMeta = z.infer<typeof RuleMetaSchema>
export type SlabEntry = z.infer<typeof SlabEntrySchema>
export type IncomeTaxRules = z.infer<typeof IncomeTaxRulesSchema>
export type WithholdingRules = z.infer<typeof WithholdingRulesSchema>
export type DeductionsRules = z.infer<typeof DeductionsRulesSchema>
export type CreditsRules = z.infer<typeof CreditsRulesSchema>
export type DeadlinesRules = z.infer<typeof DeadlinesRulesSchema>
export type LateFilingPenaltyRule = z.infer<typeof LateFilingPenaltyRuleSchema>
export type AtlSurchargeRule = z.infer<typeof AtlSurchargeRuleSchema>
export type PenaltyRules = z.infer<typeof PenaltyRulesSchema>
export type RulesIndex = z.infer<typeof RulesIndexSchema>
