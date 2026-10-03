import { CnicSchema, NtnSchema, type WithholdingValidationStatus } from '@taxdesk/schemas'

/**
 * Mirrors the IRIS 2.0 WHT-statement Data-tab row validation (per the F2 spec):
 * each row is one of Valid / Invalid Registration No. / Invalid Code / Invalid Name /
 * Invalid Transaction Date. Checked in the same precedence IRIS practitioners report
 * (registration first, since a bad NTN/CNIC blocks everything else from mattering).
 *
 * This is a pure, side-effect-free function — no DB, no I/O — so it can be unit tested
 * in isolation and reused identically by the create/update paths.
 *
 * NOTE (scope of this increment): the WHT "code" check validates *shape* only
 * (e.g. "149", "236C") rather than matching against a hard-coded section list — per the
 * tax-rules policy, specific section numbers must come from a versioned, reviewed rules
 * pack, not application code. Wire this to the `rules.withholding` code master once that
 * pack is reviewed and published for the relevant tax year.
 */

export interface WhtRowInput {
  registrationNo: string | null | undefined
  payeeName: string | null | undefined
  transactionDate: Date | null | undefined
  whtCode: string | null | undefined
  /** Tax year the entry belongs to (e.g. 2025 = year ending 30 June 2025) */
  taxYear: number
}

const WHT_CODE_SHAPE = /^\d{2,3}[A-Za-z]{0,3}$/

export function isValidRegistrationNo(value: string | null | undefined): boolean {
  if (!value || value.trim() === '') return false
  return NtnSchema.safeParse(value).success || CnicSchema.safeParse(value).success
}

export function isValidWhtCode(value: string | null | undefined): boolean {
  if (!value || value.trim() === '') return false
  return WHT_CODE_SHAPE.test(value.trim())
}

export function isValidPayeeName(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length >= 2 && /[A-Za-z\u0600-\u06FF]/.test(trimmed)
}

/** Pakistan fiscal/tax year runs 1 July (taxYear-1) to 30 June (taxYear). */
export function isWithinTaxYearWindow(date: Date, taxYear: number): boolean {
  const start = new Date(Date.UTC(taxYear - 1, 6, 1)) // 1 July
  const end = new Date(Date.UTC(taxYear, 5, 30, 23, 59, 59, 999)) // 30 June
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
}

export function isValidTransactionDate(
  value: Date | null | undefined,
  taxYear: number,
): boolean {
  if (!value || Number.isNaN(value.getTime())) return false
  return isWithinTaxYearWindow(value, taxYear)
}

export function validateWhtRow(input: WhtRowInput): WithholdingValidationStatus {
  if (!isValidRegistrationNo(input.registrationNo)) return 'INVALID_REGISTRATION_NO'
  if (!isValidWhtCode(input.whtCode)) return 'INVALID_CODE'
  if (!isValidPayeeName(input.payeeName)) return 'INVALID_NAME'
  if (!isValidTransactionDate(input.transactionDate, input.taxYear)) {
    return 'INVALID_TRANSACTION_DATE'
  }
  return 'VALID'
}
