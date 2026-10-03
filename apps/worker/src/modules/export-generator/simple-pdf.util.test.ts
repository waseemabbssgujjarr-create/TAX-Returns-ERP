import { describe, expect, it } from 'vitest'

import { buildReportLines } from './report-lines.util'
import { buildSimplePdf, _pdfInternals } from './simple-pdf.util'

describe('buildSimplePdf', () => {
  it('produces a PDF header and EOF marker', () => {
    const buf = buildSimplePdf(['TaxDesk PK Export', 'DRAFT — not FBR/IRIS filing'])
    const text = buf.toString('latin1')
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.includes('%%EOF')).toBe(true)
    expect(text.includes('TaxDesk PK Export')).toBe(true)
  })

  it('paginates when content exceeds one page', () => {
    const many = Array.from({ length: _pdfInternals.LINES_PER_PAGE + 5 }, (_, i) => `Line ${i}`)
    const buf = buildSimplePdf(many)
    const text = buf.toString('latin1')
    expect(text.includes('/Count 2')).toBe(true)
  })
})

describe('buildReportLines', () => {
  const base = {
    locale: 'en' as const,
    firmName: 'Demo Firm',
    clientName: 'Demo Client',
    taxYear: 2025,
    rulesVersion: '0.1.0-DRAFT',
    rulesState: 'DRAFT',
    wealthStatus: 'DISCREPANCY' as string | null,
    wealthDiscrepancyPaisa: '100',
    withholdingMatched: 1,
    withholdingTotal: 2,
    withholdingTaxDeductedPaisa: '50',
    computationStatus: 'SUCCESS' as string | null,
    taxPayablePaisa: '999',
    returnPrepReview: 'DRAFT' as string | null,
    returnPrepValidationStatus: 'blocked',
    sectionComplete: 3,
    sectionTotal: 12,
    draftBanner: true,
  }

  it('marks NOT IRIS and draft warning for all types', () => {
    for (const exportType of ['TAX_SUMMARY_PDF', 'RETURN_WORKSHEET', 'WEALTH_STATEMENT']) {
      const lines = buildReportLines({ ...base, exportType })
      expect(lines.some((l) => l.includes('NOT automated FBR/IRIS'))).toBe(true)
      expect(lines.some((l) => /draft\/unavailable/i.test(l))).toBe(true)
    }
  })

  it('includes type-specific sections', () => {
    const summary = buildReportLines({ ...base, exportType: 'TAX_SUMMARY_PDF' }).join('\n')
    expect(summary).toContain('Tax summary')
    expect(summary).toContain('Tax payable')

    const sheet = buildReportLines({ ...base, exportType: 'RETURN_WORKSHEET' }).join('\n')
    expect(sheet).toContain('Return worksheet')
    expect(sheet).toContain('Sections complete: 3/12')

    const wealth = buildReportLines({ ...base, exportType: 'WEALTH_STATEMENT' }).join('\n')
    expect(wealth).toContain('Wealth statement')
    expect(wealth).toContain('never auto-corrected')
  })
})
