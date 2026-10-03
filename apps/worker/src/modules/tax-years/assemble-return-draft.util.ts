import {
  TaxYearSectionKeySchema,
  type DataProvenance,
  type ReturnPrepDraftV1,
  type ReturnPrepFieldState,
  type ReturnPrepValidation,
} from '@taxdesk/schemas'

const SECTION_KEYS = TaxYearSectionKeySchema.options

const SECTION_LABELS: Record<(typeof SECTION_KEYS)[number], string> = {
  income: 'Income',
  salary: 'Salary',
  business: 'Business',
  property: 'Property',
  otherSources: 'Other sources',
  deductions: 'Deductions',
  credits: 'Credits',
  withholding: 'Withholding',
  assets: 'Assets',
  liabilities: 'Liabilities',
  expenses: 'Expenses',
  taxPayments: 'Tax payments',
}

export type AssembleReturnDraftInput = {
  taxYear: number
  clientId: string
  rulesVersion: string | null
  sections: Record<string, unknown>
  wealth: {
    status: string
    reviewStatus: string
    discrepancyPaisa: string
  } | null
  withholding: Array<{ matched: boolean; taxDeductedPaisa: string }>
  computation: {
    snapshotId: string
    status: string
    rulesVersion: string | null
    resultJson: unknown
  } | null
  documentCount: number
  notes?: string
  assembledAt?: string
}

function isDraftRulesVersion(version: string | null | undefined): boolean {
  if (!version) return false
  return /draft|placeholder/i.test(version)
}

function resolveRulesState(
  rulesVersion: string | null,
  computationStatus: string | null,
): ReturnPrepDraftV1['rulesState'] {
  if (computationStatus === 'RULES_UNAVAILABLE') return 'UNAVAILABLE'
  if (isDraftRulesVersion(rulesVersion)) return 'DRAFT'
  if (computationStatus === 'SUCCESS' && rulesVersion) return 'AVAILABLE'
  if (rulesVersion) return 'UNKNOWN'
  return 'UNKNOWN'
}

function provenanceToFieldState(
  provenance: DataProvenance | undefined,
  complete: boolean | undefined,
  present: boolean,
): ReturnPrepFieldState {
  if (!present) return 'missing'
  if (provenance === 'verified') return 'verified'
  if (provenance === 'calculated') return 'calculated'
  if (provenance === 'extracted') return complete === true ? 'extracted' : 'needs_review'
  if (provenance === 'draft_rules') return 'needs_review'
  if (complete === false) return 'needs_review'
  if (provenance === 'editable' || provenance === undefined) {
    return present ? 'entered' : 'missing'
  }
  return 'needs_review'
}

function asSectionPayload(value: unknown): {
  present: boolean
  complete?: boolean
  provenance?: DataProvenance
  fieldState: ReturnPrepFieldState
} {
  if (!value || typeof value !== 'object') {
    return { present: false, fieldState: 'missing' }
  }
  const obj = value as Record<string, unknown>
  const complete = typeof obj.complete === 'boolean' ? obj.complete : undefined
  const provenance =
    typeof obj.provenance === 'string' ? (obj.provenance as DataProvenance) : undefined
  return {
    present: true,
    ...(complete !== undefined ? { complete } : {}),
    ...(provenance !== undefined ? { provenance } : {}),
    fieldState: provenanceToFieldState(provenance, complete, true),
  }
}

function taxPayableFromResult(resultJson: unknown): string | null {
  if (!resultJson || typeof resultJson !== 'object') return null
  const obj = resultJson as Record<string, unknown>
  for (const key of ['taxPayablePaisa', 'netTaxPaisa', 'taxPayable']) {
    const v = obj[key]
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
      return String(v)
    }
  }
  return null
}

function buildValidation(input: {
  sectionsComplete: boolean
  wealthReviewed: boolean
  withholdingReconciled: boolean
  computationOk: boolean
  rulesState: ReturnPrepDraftV1['rulesState']
  missingCount: number
  needsReviewCount: number
  wealthDiscrepancy: boolean
  unmatchedWithholding: number
  documentCount: number
}): ReturnPrepValidation {
  const issues: ReturnPrepValidation['issues'] = []

  if (!input.sectionsComplete) {
    issues.push({
      code: 'SECTIONS_INCOMPLETE',
      severity: 'error',
      message: 'Not all tax-year sections are marked complete.',
      path: 'sections',
    })
  }
  if (input.missingCount > 0) {
    issues.push({
      code: 'MISSING_FIELDS',
      severity: 'error',
      message: `${input.missingCount} workspace section(s) have no data yet.`,
      path: 'missing',
    })
  }
  if (input.needsReviewCount > 0) {
    issues.push({
      code: 'NEEDS_REVIEW_FIELDS',
      severity: 'warning',
      message: `${input.needsReviewCount} section(s) still need human review.`,
      path: 'fields',
    })
  }
  if (!input.wealthReviewed) {
    issues.push({
      code: 'WEALTH_NOT_REVIEWED',
      severity: 'error',
      message: 'Wealth statement is missing or not yet reviewed/reconciled.',
      path: 'wealth',
    })
  }
  if (input.wealthDiscrepancy) {
    issues.push({
      code: 'WEALTH_DISCREPANCY',
      severity: 'error',
      message: 'Wealth discrepancy remains unexplained.',
      path: 'wealth',
    })
  }
  if (!input.withholdingReconciled) {
    issues.push({
      code: 'WITHHOLDING_OPEN',
      severity: 'warning',
      message:
        input.unmatchedWithholding > 0
          ? `${input.unmatchedWithholding} withholding entr(y/ies) unmatched.`
          : 'No matched withholding entries yet.',
      path: 'withholding',
    })
  }
  if (input.rulesState === 'DRAFT' || input.rulesState === 'UNAVAILABLE') {
    issues.push({
      code: 'RULES_BLOCKED',
      severity: 'error',
      message:
        input.rulesState === 'DRAFT'
          ? 'Draft/placeholder tax rules block approval. Computation stays fail-closed for filing readiness.'
          : 'Tax rules are unavailable. Computation stays fail-closed.',
      path: 'rules',
    })
  }
  if (!input.computationOk) {
    issues.push({
      code: 'COMPUTATION_NOT_READY',
      severity: 'error',
      message: 'A successful computation with non-draft rules is required before approval.',
      path: 'computation',
    })
  }
  if (input.documentCount === 0) {
    issues.push({
      code: 'NO_DOCUMENTS',
      severity: 'warning',
      message: 'No documents are linked to this tax year yet.',
      path: 'documents',
    })
  }

  issues.push({
    code: 'HUMAN_REVIEW_REQUIRED',
    severity: 'info',
    message: 'Human review is always required. This draft is not FBR/IRIS filing.',
  })

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const blockedByRules = input.rulesState === 'DRAFT' || input.rulesState === 'UNAVAILABLE'

  const hardBlock =
    blockedByRules ||
    input.missingCount > 0 ||
    !input.wealthReviewed ||
    input.wealthDiscrepancy ||
    !input.computationOk

  const canSubmitForReview = !blockedByRules && input.missingCount === 0
  const canApprove = !hardBlock && errorCount === 0 && input.sectionsComplete

  let status: ReturnPrepValidation['status'] = 'incomplete'
  if (blockedByRules) status = 'blocked'
  else if (canApprove) status = 'approved_gate_ok'
  else if (canSubmitForReview && !input.wealthDiscrepancy) status = 'ready_for_review'
  else status = 'incomplete'

  return {
    status,
    canSubmitForReview,
    canApprove,
    errorCount,
    warningCount,
    issues,
  }
}

/** Pure assembler — no tax rule invention; surfaces draft/unavailable state explicitly. */
export function assembleReturnDraft(input: AssembleReturnDraftInput): ReturnPrepDraftV1 {
  const sections: ReturnPrepDraftV1['sections'] = {} as ReturnPrepDraftV1['sections']
  const fields: ReturnPrepDraftV1['fields'] = []
  const missing: ReturnPrepDraftV1['missing'] = []
  let completeCount = 0
  let needsReviewCount = 0

  for (const key of SECTION_KEYS) {
    const summary = asSectionPayload(input.sections[key])
    sections[key] = {
      present: summary.present,
      ...(summary.complete !== undefined ? { complete: summary.complete } : {}),
      ...(summary.provenance !== undefined ? { provenance: summary.provenance } : {}),
      fieldState: summary.fieldState,
    }
    if (summary.complete === true) completeCount += 1

    const label = SECTION_LABELS[key]
    fields.push({
      path: `sections.${key}`,
      sectionKey: key,
      label,
      state: summary.fieldState,
      ...(summary.provenance !== undefined ? { provenance: summary.provenance } : {}),
      ...(summary.complete !== undefined ? { complete: summary.complete } : {}),
    })

    if (summary.fieldState === 'missing') {
      missing.push({
        path: `sections.${key}`,
        label,
        reason: 'No data present for this section yet.',
      })
    } else if (summary.fieldState === 'needs_review') {
      needsReviewCount += 1
    }
  }

  const matchedCount = input.withholding.filter((w) => w.matched).length
  const unmatchedCount = input.withholding.length - matchedCount
  let totalTaxDeducted = 0n
  for (const w of input.withholding) {
    try {
      totalTaxDeducted += BigInt(w.taxDeductedPaisa)
    } catch {
      // ignore malformed paisa strings in draft assembly
    }
  }

  const computationStatus = input.computation?.status ?? null
  const effectiveRulesVersion = input.computation?.rulesVersion ?? input.rulesVersion
  const rulesState = resolveRulesState(effectiveRulesVersion, computationStatus)

  const warnings: ReturnPrepDraftV1['warnings'] = [
    {
      code: 'NOT_FILING',
      message:
        'This draft is for staff review and export preparation only. It is not automated FBR/IRIS filing.',
    },
  ]

  if (rulesState === 'DRAFT') {
    warnings.push({
      code: 'RULES_DRAFT',
      message:
        'Tax rules for this year are draft/placeholder. Computed figures must not be treated as filing-ready.',
    })
  }
  if (rulesState === 'UNAVAILABLE') {
    warnings.push({
      code: 'RULES_UNAVAILABLE',
      message: 'Rules are not available for this tax year. Computation stays fail-closed.',
    })
  }
  if (input.wealth && input.wealth.status === 'DISCREPANCY') {
    warnings.push({
      code: 'WEALTH_DISCREPANCY',
      message: `Wealth statement discrepancy of ${input.wealth.discrepancyPaisa} paisa remains unexplained.`,
    })
  }
  if (unmatchedCount > 0) {
    warnings.push({
      code: 'WITHHOLDING_UNMATCHED',
      message: `${unmatchedCount} withholding entr${unmatchedCount === 1 ? 'y' : 'ies'} unmatched.`,
    })
  }
  if (!input.computation || computationStatus !== 'SUCCESS') {
    warnings.push({
      code: 'COMPUTATION_PENDING',
      message: 'No successful computation snapshot is attached to this draft.',
    })
  }

  const sectionsComplete = completeCount === SECTION_KEYS.length
  const wealthReviewed = Boolean(
    input.wealth &&
      (input.wealth.reviewStatus === 'APPROVED' || input.wealth.status === 'RECONCILED'),
  )
  const withholdingReconciled = input.withholding.length > 0 && unmatchedCount === 0
  const computationOk = computationStatus === 'SUCCESS' && rulesState === 'AVAILABLE'
  const wealthDiscrepancy = Boolean(input.wealth && input.wealth.status === 'DISCREPANCY')

  if (!input.wealth) {
    missing.push({
      path: 'wealth',
      label: 'Wealth statement',
      reason: 'Wealth statement has not been created for this tax year.',
    })
  }

  const validation = buildValidation({
    sectionsComplete,
    wealthReviewed,
    withholdingReconciled,
    computationOk,
    rulesState,
    missingCount: missing.length,
    needsReviewCount,
    wealthDiscrepancy,
    unmatchedWithholding: unmatchedCount,
    documentCount: input.documentCount,
  })

  return {
    schemaVersion: 1,
    taxYear: input.taxYear,
    clientId: input.clientId,
    assembledAt: input.assembledAt ?? new Date().toISOString(),
    rulesVersion: effectiveRulesVersion,
    rulesState,
    filingDisclaimer: 'NOT_IRIS_FBR_SUBMISSION',
    sections,
    sectionCompleteness: {
      complete: completeCount,
      total: SECTION_KEYS.length,
    },
    fields,
    missing,
    validation,
    wealth: input.wealth
      ? {
          present: true,
          status: input.wealth.status,
          reviewStatus: input.wealth.reviewStatus,
          discrepancyPaisa: input.wealth.discrepancyPaisa,
        }
      : {
          present: false,
          status: null,
          reviewStatus: null,
          discrepancyPaisa: null,
        },
    withholding: {
      entryCount: input.withholding.length,
      matchedCount,
      unmatchedCount,
      totalTaxDeductedPaisa: totalTaxDeducted.toString(),
    },
    computation: input.computation
      ? {
          snapshotId: input.computation.snapshotId,
          status: input.computation.status,
          rulesVersion: input.computation.rulesVersion,
          taxPayablePaisa: taxPayableFromResult(input.computation.resultJson),
        }
      : null,
    documents: { count: input.documentCount },
    warnings,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    checklist: {
      sectionsComplete,
      wealthReviewed,
      withholdingReconciled,
      computationOk,
      humanReviewRequired: true,
    },
  }
}
