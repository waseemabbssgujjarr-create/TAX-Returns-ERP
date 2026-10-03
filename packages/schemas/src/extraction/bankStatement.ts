import { z } from 'zod'

import { IsoDateSchema, PaisaNumberSchema } from '../common'

/**
 * Bank Statement extraction schema.
 * Returned by the AI extraction adapter and validated before any use.
 *
 * IMPORTANT: This schema is the contract between the AI output and the application.
 * All fields are nullable — the AI must return null for missing/unreadable values,
 * never guess. Validation after extraction is deterministic.
 */

export const BankTransactionSchema = z.object({
  /** ISO date of the transaction */
  date: IsoDateSchema.nullable(),
  description: z.string(),
  /** Debit amount in paisa (null if credit-only row) */
  debit: PaisaNumberSchema.nullable(),
  /** Credit amount in paisa (null if debit-only row) */
  credit: PaisaNumberSchema.nullable(),
  /** Running balance in paisa after this transaction */
  balance: PaisaNumberSchema.nullable(),
  /** Page number in the source PDF where this transaction appears */
  sourcePage: z.number().int().min(1),
  /** Short verbatim snippet from the source for traceability */
  sourceSnippet: z.string(),
  /** Confidence 0..1 for this row */
  rowConfidence: z.number().min(0).max(1),
  /** AI-assigned category — always require human confirmation */
  suggestedCategory: z.string().nullable(),
})

export type BankTransaction = z.infer<typeof BankTransactionSchema>

export const BankStatementExtractionSchema = z.object({
  bankName: z.string().nullable(),
  accountTitle: z.string().nullable(),
  /** Last 4 digits only — never store full account number from AI output */
  accountNumberLast4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  branchName: z.string().nullable(),
  periodStart: IsoDateSchema.nullable(),
  periodEnd: IsoDateSchema.nullable(),
  openingBalance: PaisaNumberSchema.nullable(),
  closingBalance: PaisaNumberSchema.nullable(),
  currency: z.string().default('PKR'),

  /** Total profit/interest credited during the period, in paisa */
  profitCredited: PaisaNumberSchema.nullable(),
  /** Total withholding tax deducted on profit, in paisa */
  taxDeductedOnProfit: PaisaNumberSchema.nullable(),

  transactions: z.array(BankTransactionSchema),

  /** Per-field confidence scores 0..1 */
  fieldConfidence: z.record(z.number().min(0).max(1)),

  /** Overall extraction confidence 0..1 */
  overallConfidence: z.number().min(0).max(1),

  /** Page numbers in the source document */
  pagesCovered: z.array(z.number().int().min(1)),
})

export type BankStatementExtraction = z.infer<typeof BankStatementExtractionSchema>

/**
 * Deterministic validation rules applied AFTER AI extraction.
 * Returns a list of validation issues — empty means clean.
 */
export function validateBankStatement(
  data: BankStatementExtraction,
): Array<{ field: string; issue: string; severity: 'error' | 'warning' }> {
  const issues: Array<{ field: string; issue: string; severity: 'error' | 'warning' }> = []

  // Running balance continuity check
  let prev = data.openingBalance
  for (let i = 0; i < data.transactions.length; i++) {
    const tx = data.transactions[i]
    if (prev === null || tx === undefined || tx.balance === null) {
      prev = tx?.balance ?? null
      continue
    }

    const debit = tx.debit ?? 0
    const credit = tx.credit ?? 0
    const expectedBalance = prev - debit + credit

    if (Math.abs(expectedBalance - tx.balance) > 1) {
      // Allow 1 paisa rounding tolerance
      issues.push({
        field: `transactions[${i}].balance`,
        issue: `Balance mismatch: expected ${expectedBalance}, got ${tx.balance}. Possible missing page or transaction.`,
        severity: 'error',
      })
    }

    prev = tx.balance
  }

  // Closing balance should equal last transaction balance
  if (
    data.closingBalance !== null &&
    data.transactions.length > 0 &&
    data.transactions[data.transactions.length - 1]?.balance !== null
  ) {
    const lastBalance = data.transactions[data.transactions.length - 1]!.balance!
    if (Math.abs(lastBalance - data.closingBalance) > 1) {
      issues.push({
        field: 'closingBalance',
        issue: `Closing balance (${data.closingBalance}) does not match last transaction balance (${lastBalance}).`,
        severity: 'warning',
      })
    }
  }

  // Date range check: all transactions should fall within periodStart..periodEnd
  if (data.periodStart && data.periodEnd) {
    for (let i = 0; i < data.transactions.length; i++) {
      const tx = data.transactions[i]
      if (!tx?.date) continue
      if (tx.date < data.periodStart || tx.date > data.periodEnd) {
        issues.push({
          field: `transactions[${i}].date`,
          issue: `Transaction date ${tx.date} is outside the statement period ${data.periodStart}–${data.periodEnd}.`,
          severity: 'warning',
        })
      }
    }
  }

  return issues
}
