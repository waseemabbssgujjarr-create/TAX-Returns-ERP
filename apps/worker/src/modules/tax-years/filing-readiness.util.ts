import type { FilingReadiness } from '@taxdesk/schemas'

export type FilingReadinessInput = {
  returnPrepReviewStatus: string | null
  returnPrepValidationStatus: string | null
  wealthStatus: string | null
  wealthReviewStatus: string | null
  withholdingUnmatchedCount: number
  /** Rows with an explicit IRIS-invalid status (Invalid Registration No./Code/Name/Transaction Date). */
  withholdingInvalidCount: number
  /** Rows where tax was actually withheld but no CPR (Computerized Payment Receipt) is on file yet. */
  withholdingMissingCprCount: number
  documentCount: number
}

/**
 * "Ready to file" checklist — gates the Submit-to-IRIS action.
 * Pure function; does not invent tax rules or compliance determinations.
 */
export function computeFilingReadiness(input: FilingReadinessInput): FilingReadiness {
  const items: FilingReadiness['items'] = [
    {
      code: 'RETURN_PREP_APPROVED',
      label: 'Return preparation approved by a reviewer',
      ok: input.returnPrepReviewStatus === 'APPROVED',
      severity: 'error',
    },
    {
      code: 'RETURN_PREP_VALIDATION_OK',
      label: 'Return preparation validation gate cleared',
      ok: input.returnPrepValidationStatus === 'approved_gate_ok',
      severity: 'error',
    },
    {
      code: 'WEALTH_RECONCILED',
      label: 'Wealth statement reconciled (no open discrepancy)',
      ok: input.wealthStatus === 'RECONCILED' && input.wealthReviewStatus === 'APPROVED',
      severity: 'error',
    },
    {
      code: 'WITHHOLDING_MATCHED',
      label: 'All withholding entries matched',
      ok: input.withholdingUnmatchedCount === 0,
      severity: 'warning',
    },
    {
      code: 'WITHHOLDING_ROWS_VALID',
      label: 'All withholding rows pass IRIS row validation (registration no. / code / name / date)',
      ok: input.withholdingInvalidCount === 0,
      severity: 'error',
    },
    {
      code: 'WITHHOLDING_CPR_RECORDED',
      label: 'CPR (Computerized Payment Receipt) on file for every withheld-tax row — IRIS blocks submission without it',
      ok: input.withholdingMissingCprCount === 0,
      severity: 'error',
    },
    {
      code: 'DOCUMENTS_ATTACHED',
      label: 'At least one supporting document attached',
      ok: input.documentCount > 0,
      severity: 'warning',
    },
  ]

  const readyToFile = items.filter((i) => i.severity === 'error').every((i) => i.ok)

  return { readyToFile, items }
}
