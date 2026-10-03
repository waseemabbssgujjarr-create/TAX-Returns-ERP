export type ReportPayload = {
  exportType: string
  locale: 'en' | 'ur'
  firmName: string
  clientName: string
  taxYear: number
  rulesVersion: string | null
  rulesState: string
  wealthStatus: string | null
  wealthDiscrepancyPaisa?: string | null
  withholdingMatched: number
  withholdingTotal: number
  withholdingTaxDeductedPaisa?: string | null
  computationStatus: string | null
  taxPayablePaisa?: string | null
  returnPrepReview: string | null
  returnPrepValidationStatus?: string | null
  sectionComplete?: number
  sectionTotal?: number
  draftBanner: boolean
}

function commonHeader(payload: ReportPayload): string[] {
  const lines = [
    'TaxDesk PK — Staff Export',
    `Type: ${payload.exportType}`,
    `Locale: ${payload.locale}`,
    `Firm: ${payload.firmName}`,
    `Client: ${payload.clientName}`,
    `Tax year: ${payload.taxYear}`,
    `Rules version: ${payload.rulesVersion ?? 'n/a'}`,
    `Rules state: ${payload.rulesState}`,
    '',
    'IMPORTANT: Draft staff export — NOT automated FBR/IRIS filing.',
  ]

  if (
    payload.draftBanner ||
    payload.rulesState === 'DRAFT' ||
    payload.rulesState === 'UNAVAILABLE'
  ) {
    lines.push('WARNING: Tax rules are draft/unavailable. Figures are not filing-ready.')
  }

  return lines
}

function commonFooter(payload: ReportPayload): string[] {
  const lines = ['', 'Human review required before any filing.']
  if (payload.locale === 'ur') {
    lines.push('Urdu glyph PDF requires Playwright renderer; this artifact uses Latin metadata.')
  }
  return lines
}

/** Type-specific staff report lines — never invents tax rates or filing payloads. */
export function buildReportLines(payload: ReportPayload): string[] {
  const lines = [...commonHeader(payload)]

  switch (payload.exportType) {
    case 'TAX_SUMMARY_PDF':
      lines.push(
        '',
        '— Tax summary —',
        `Computation status: ${payload.computationStatus ?? 'missing'}`,
        `Tax payable (paisa, from snapshot): ${payload.taxPayablePaisa ?? 'n/a'}`,
        `Withholding matched: ${payload.withholdingMatched}/${payload.withholdingTotal}`,
        `Withholding deducted (paisa): ${payload.withholdingTaxDeductedPaisa ?? 'n/a'}`,
        `Return prep review: ${payload.returnPrepReview ?? 'missing'}`,
        `Return prep validation: ${payload.returnPrepValidationStatus ?? 'n/a'}`,
      )
      break
    case 'RETURN_WORKSHEET':
      lines.push(
        '',
        '— Return worksheet (structured draft summary) —',
        `Sections complete: ${payload.sectionComplete ?? 0}/${payload.sectionTotal ?? 0}`,
        `Return prep review: ${payload.returnPrepReview ?? 'missing'}`,
        `Validation: ${payload.returnPrepValidationStatus ?? 'n/a'}`,
        `Computation: ${payload.computationStatus ?? 'missing'}`,
        `Rules: ${payload.rulesState}`,
        '',
        'This worksheet mirrors staff return-preparation state only.',
        'It is not an IRIS XML or FBR submission package.',
      )
      break
    case 'WEALTH_STATEMENT':
      lines.push(
        '',
        '— Wealth statement export —',
        `Wealth status: ${payload.wealthStatus ?? 'missing'}`,
        `Discrepancy (paisa): ${payload.wealthDiscrepancyPaisa ?? 'n/a'}`,
        '',
        'Wealth differences are never auto-corrected by TaxDesk.',
      )
      break
    default:
      lines.push(
        '',
        `Wealth status: ${payload.wealthStatus ?? 'missing'}`,
        `Withholding matched: ${payload.withholdingMatched}/${payload.withholdingTotal}`,
        `Computation: ${payload.computationStatus ?? 'missing'}`,
        `Return prep review: ${payload.returnPrepReview ?? 'missing'}`,
      )
  }

  lines.push(...commonFooter(payload))
  return lines
}
