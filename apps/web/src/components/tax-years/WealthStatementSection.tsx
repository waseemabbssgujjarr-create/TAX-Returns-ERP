'use client'

import type { WealthStatementDto } from '@taxdesk/schemas'
import { WealthReviewStatusSchema } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchWealthStatement, upsertWealthStatement } from '@/lib/api/wealth'

function rupeesToPaisa(rupees: string): string {
  const cleaned = rupees.replace(/,/g, '').trim()
  if (!cleaned || Number.isNaN(Number(cleaned))) return '0'
  return String(BigInt(Math.round(Number(cleaned) * 100)))
}

function paisaToRupeesInput(paisa: string): string {
  try {
    return (Number(BigInt(paisa)) / 100).toFixed(2)
  } catch {
    return '0.00'
  }
}

function formatPkr(paisa: string): string {
  const rupees = Number(BigInt(paisa) / BigInt(100))
  return `PKR ${rupees.toLocaleString()}`
}

export function WealthStatementSection({
  taxYearFileId,
  accessToken,
}: {
  taxYearFileId: string
  accessToken: string
}) {
  const t = useTranslations('taxYears.wealth')
  const [row, setRow] = useState<WealthStatementDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState('0')
  const [closing, setClosing] = useState('0')
  const [income, setIncome] = useState('0')
  const [expenses, setExpenses] = useState('0')
  const [taxPaid, setTaxPaid] = useState('0')
  const [explanation, setExplanation] = useState('')
  const [reviewStatus, setReviewStatus] = useState('NOT_STARTED')

  const load = useCallback(async () => {
    const data = await fetchWealthStatement(accessToken, taxYearFileId)
    setRow(data)
    if (data) {
      setOpening(paisaToRupeesInput(data.openingWealthPaisa))
      setClosing(paisaToRupeesInput(data.closingWealthPaisa))
      setIncome(paisaToRupeesInput(data.incomeTotalPaisa))
      setExpenses(paisaToRupeesInput(data.expenseTotalPaisa))
      setTaxPaid(paisaToRupeesInput(data.taxTotalPaisa))
      setExplanation(data.explanation ?? '')
      setReviewStatus(data.reviewStatus)
    }
  }, [accessToken, taxYearFileId])

  useEffect(() => {
    void load()
  }, [load])

  const preview = useMemo(() => {
    const o = BigInt(rupeesToPaisa(opening))
    const i = BigInt(rupeesToPaisa(income))
    const e = BigInt(rupeesToPaisa(expenses))
    const tax = BigInt(rupeesToPaisa(taxPaid))
    const c = BigInt(rupeesToPaisa(closing))
    const expected = o + i - e - tax
    const discrepancy = c - expected
    return {
      expected: expected.toString(),
      discrepancy: discrepancy.toString(),
      mismatched: discrepancy !== 0n,
    }
  }, [opening, income, expenses, taxPaid, closing])

  async function save(nextReview?: string) {
    setSaving(true)
    try {
      const body = {
        openingWealthPaisa: rupeesToPaisa(opening),
        closingWealthPaisa: rupeesToPaisa(closing),
        incomeTotalPaisa: rupeesToPaisa(income),
        expenseTotalPaisa: rupeesToPaisa(expenses),
        taxTotalPaisa: rupeesToPaisa(taxPaid),
        explanation: explanation.trim() ? explanation.trim() : null,
        reviewStatus: WealthReviewStatusSchema.parse(nextReview ?? reviewStatus),
      }
      const saved = await upsertWealthStatement(accessToken, taxYearFileId, body)
      setRow(saved)
      setReviewStatus(saved.reviewStatus)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="border-border rounded-lg border p-4" aria-labelledby="wealth-heading">
      <h2 id="wealth-heading" className="text-lg font-medium">
        {t('title')}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">{t('formulaHint')}</p>
      <p className="text-muted-foreground mt-1 text-xs">{t('editorHint')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            ['opening', opening, setOpening, t('opening')],
            ['assetsIncome', income, setIncome, t('income')],
            ['expenses', expenses, setExpenses, t('expenses')],
            ['taxPaid', taxPaid, setTaxPaid, t('taxPaid')],
            ['closing', closing, setClosing, t('closing')],
          ] as const
        ).map(([key, value, setter, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-muted-foreground mb-1 block">{label}</span>
            <input
              type="text"
              inputMode="decimal"
              className="border-border bg-surface w-full rounded-md border px-3 py-2 font-mono"
              value={value}
              onChange={(e) => setter(e.target.value)}
              disabled={saving}
              aria-label={label}
            />
          </label>
        ))}
      </div>

      <div className="border-border bg-surface-hover/40 mt-4 rounded-md border p-3 text-sm">
        <p>
          <span className="text-muted-foreground">{t('expectedClosing')}:</span>{' '}
          <span className="font-mono">{formatPkr(preview.expected)}</span>
          <span className="text-muted-foreground ms-2 text-xs">({t('calculated')})</span>
        </p>
        <p className={preview.mismatched ? 'text-warning mt-1 font-medium' : 'mt-1'}>
          <span className="text-muted-foreground">{t('discrepancy')}:</span>{' '}
          {formatPkr(preview.discrepancy)}
          {preview.mismatched ? ` — ${t('mismatchDetected')}` : ''}
        </p>
        {row && (
          <p className="text-muted-foreground mt-1 text-xs">
            {t('savedStatus')}: {t(`status.${row.status}`)}
          </p>
        )}
      </div>

      <label className="mt-4 block text-sm">
        <span className="text-muted-foreground mb-1 block">{t('explanation')}</span>
        <textarea
          className="border-border bg-surface min-h-24 w-full rounded-md border px-3 py-2"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          disabled={saving}
          placeholder={t('explanationPlaceholder')}
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="text-muted-foreground mb-1 block">{t('review')}</span>
        <select
          className="border-border bg-surface w-full rounded-md border px-3 py-2 sm:max-w-xs"
          value={reviewStatus}
          disabled={saving}
          onChange={(e) => setReviewStatus(e.target.value)}
        >
          {WealthReviewStatusSchema.options.map((value) => (
            <option key={value} value={value}>
              {t(`reviewStatus.${value}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? t('saving') : t('reconcile')}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={() => void save('IN_REVIEW')}>
          {t('submitReview')}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={() => void save('APPROVED')}>
          {t('approve')}
        </Button>
      </div>
    </section>
  )
}
