import { z } from 'zod'

import { IsoDateSchema, PaisaNumberSchema } from '../common'

/**
 * Salary Certificate / Payslip extraction schema.
 * Covers both annual salary certificates and monthly payslips.
 */

export const AllowanceItemSchema = z.object({
  /** Type of allowance e.g. "House Rent Allowance", "Medical Allowance" */
  type: z.string(),
  /** Amount in paisa */
  amount: PaisaNumberSchema,
  sourcePage: z.number().int().min(1),
  sourceSnippet: z.string(),
})

export type AllowanceItem = z.infer<typeof AllowanceItemSchema>

export const SalaryCertificateExtractionSchema = z.object({
  // ── Employer ──────────────────────────────────────────────────────────────
  employerName: z.string().nullable(),
  employerNtn: z.string().nullable(),
  employerAddress: z.string().nullable(),

  // ── Employee ──────────────────────────────────────────────────────────────
  employeeName: z.string().nullable(),
  /** Last 4 of CNIC for matching — never store full CNIC from AI output */
  employeeCnicLast4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  employeeDesignation: z.string().nullable(),

  // ── Period ────────────────────────────────────────────────────────────────
  periodStart: IsoDateSchema.nullable(),
  periodEnd: IsoDateSchema.nullable(),
  /** Is this a monthly payslip or an annual certificate? */
  documentSubtype: z.enum(['MONTHLY_PAYSLIP', 'ANNUAL_CERTIFICATE', 'UNKNOWN']).default('UNKNOWN'),

  // ── Salary components (all in paisa) ──────────────────────────────────────
  basicSalary: PaisaNumberSchema.nullable(),
  allowances: z.array(AllowanceItemSchema),
  /** Total allowances (should equal sum of allowances array — validated) */
  totalAllowances: PaisaNumberSchema.nullable(),
  perquisites: PaisaNumberSchema.nullable(),
  bonus: PaisaNumberSchema.nullable(),
  grossSalary: PaisaNumberSchema.nullable(),

  // ── Deductions ────────────────────────────────────────────────────────────
  /** Provident fund deduction in paisa */
  providentFundEmployee: PaisaNumberSchema.nullable(),
  providentFundEmployer: PaisaNumberSchema.nullable(),
  otherDeductions: PaisaNumberSchema.nullable(),

  // ── Tax ───────────────────────────────────────────────────────────────────
  /** Tax deducted this month/year in paisa */
  taxDeducted: PaisaNumberSchema.nullable(),
  /** For annual certificates: cumulative tax deducted for the full year */
  annualTaxDeducted: PaisaNumberSchema.nullable(),

  // ── Net pay ───────────────────────────────────────────────────────────────
  netPay: PaisaNumberSchema.nullable(),

  // ── Confidence & traceability ─────────────────────────────────────────────
  fieldConfidence: z.record(z.number().min(0).max(1)),
  overallConfidence: z.number().min(0).max(1),
  pagesCovered: z.array(z.number().int().min(1)),
})

export type SalaryCertificateExtraction = z.infer<typeof SalaryCertificateExtractionSchema>

/**
 * Deterministic validation applied after AI extraction.
 */
export function validateSalaryCertificate(
  data: SalaryCertificateExtraction,
): Array<{ field: string; issue: string; severity: 'error' | 'warning' }> {
  const issues: Array<{ field: string; issue: string; severity: 'error' | 'warning' }> = []

  // Gross salary should equal basic + total allowances + perquisites + bonus
  if (data.grossSalary !== null && data.basicSalary !== null) {
    const totalAllowances =
      data.totalAllowances ?? data.allowances.reduce((s, a) => s + a.amount, 0)
    const perquisites = data.perquisites ?? 0
    const bonus = data.bonus ?? 0
    const computed = data.basicSalary + totalAllowances + perquisites + bonus

    // Allow 1% tolerance for rounding
    const tolerance = Math.ceil(data.grossSalary * 0.01)
    if (Math.abs(computed - data.grossSalary) > tolerance) {
      issues.push({
        field: 'grossSalary',
        issue: `Gross salary ${data.grossSalary} does not match components total ${computed}. Review allowances and perquisites.`,
        severity: 'warning',
      })
    }
  }

  // Allowances array total should match totalAllowances field
  if (data.totalAllowances !== null && data.allowances.length > 0) {
    const computed = data.allowances.reduce((s, a) => s + a.amount, 0)
    if (computed !== data.totalAllowances) {
      issues.push({
        field: 'totalAllowances',
        issue: `Total allowances field (${data.totalAllowances}) does not match sum of allowance items (${computed}).`,
        severity: 'error',
      })
    }
  }

  // Net pay check
  if (data.netPay !== null && data.grossSalary !== null && data.taxDeducted !== null) {
    const deductions =
      (data.taxDeducted ?? 0) + (data.providentFundEmployee ?? 0) + (data.otherDeductions ?? 0)
    const expectedNet = data.grossSalary - deductions
    const tolerance = Math.ceil(data.grossSalary * 0.01)
    if (Math.abs(expectedNet - data.netPay) > tolerance) {
      issues.push({
        field: 'netPay',
        issue: `Net pay ${data.netPay} does not match gross (${data.grossSalary}) minus deductions (${deductions}).`,
        severity: 'warning',
      })
    }
  }

  return issues
}
