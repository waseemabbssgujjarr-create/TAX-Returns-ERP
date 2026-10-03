'use client'

import {
  PenaltyClientTypeSchema,
  PenaltyFilingKindSchema,
  type PenaltyEstimateResult,
} from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { estimatePenalty } from '@/lib/api/compliance'
import { useAuthStore } from '@/stores/authStore'

function rupeesToPaisa(rupees: string): string {
  const cleaned = rupees.replace(/,/g, '').trim()
  if (!cleaned || Number.isNaN(Number(cleaned))) return '0'
  return String(BigInt(Math.round(Number(cleaned) * 100)))
}

function formatPkr(paisa: string): string {
  return `PKR ${(Number(BigInt(paisa)) / 100).toLocaleString()}`
}

/**
 * Late-filing / ATL-surcharge penalty estimator (F3). Mirrors Income Tax Ordinance
 * s.182 / s.182A. Honest by design: if the tax year's rules pack is still DRAFT and
 * unreviewed, this shows a blocked message instead of a number — never a fabricated figure.
 */
export function PenaltyCalculatorWidget() {
  const t = useTranslations('calendar.penaltyCalculator')
  const accessToken = useAuthStore((s) => s.accessToken)

  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [filingKind, setFilingKind] =
    useState<(typeof PenaltyFilingKindSchema.options)[number]>('INCOME_TAX_RETURN')
  const [clientType, setClientType] =
    useState<(typeof PenaltyClientTypeSchema.options)[number]>('INDIVIDUAL')
  const [taxPayable, setTaxPayable] = useState('')
  const [daysLate, setDaysLate] = useState('0')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PenaltyEstimateResult | null>(null)

  function unavailableResult(reason: string): PenaltyEstimateResult {
    return {
      available: false,
      rulesVersion: null,
      penaltyPaisa: null,
      minimumAppliedPaisa: null,
      cappedAtMaxPaisa: false,
      reductionPercentApplied: null,
      explanationKeys: [],
      blockedReason: reason,
    }
  }

  async function handleCalculate() {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await estimatePenalty(accessToken, {
        taxYear: Number(taxYear),
        filingKind,
        clientType,
        taxPayablePaisa: rupeesToPaisa(taxPayable || '0'),
        daysLate: Number(daysLate) || 0,
      })
      setResult(res)
    } catch {
      setResult(unavailableResult(t('unavailable')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border-border rounded-lg border p-4" aria-labelledby="penalty-heading">
      <h2 id="penalty-heading" className="text-lg font-medium">
        {t('title')}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">{t('hint')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('taxYear')}</span>
          <input
            type="number"
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('filingKind')}</span>
          <select
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            value={filingKind}
            onChange={(e) => setFilingKind(PenaltyFilingKindSchema.parse(e.target.value))}
          >
            {PenaltyFilingKindSchema.options.map((value) => (
              <option key={value} value={value}>
                {t(`filingKinds.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('clientType')}</span>
          <select
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            value={clientType}
            onChange={(e) => setClientType(PenaltyClientTypeSchema.parse(e.target.value))}
          >
            {PenaltyClientTypeSchema.options.map((value) => (
              <option key={value} value={value}>
                {t(`clientTypes.${value}`)}
              </option>
            ))}
          </select>
        </label>
        {filingKind === 'INCOME_TAX_RETURN' && (
          <>
            <label className="block text-sm">
              <span className="text-muted-foreground mb-1 block">{t('taxPayable')}</span>
              <input
                className="border-border bg-surface w-full rounded-md border px-3 py-2 font-mono"
                value={taxPayable}
                onChange={(e) => setTaxPayable(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground mb-1 block">{t('daysLate')}</span>
              <input
                type="number"
                min={0}
                className="border-border bg-surface w-full rounded-md border px-3 py-2"
                value={daysLate}
                onChange={(e) => setDaysLate(e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      <Button className="mt-3" disabled={loading} onClick={() => void handleCalculate()}>
        {t('calculate')}
      </Button>

      {result && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            result.available ? 'border-border' : 'border-warning/40 bg-warning/5'
          }`}
          role="status"
        >
          {result.available ? (
            <>
              <p className="text-foreground text-lg font-semibold">
                {formatPkr(result.penaltyPaisa ?? '0')}
              </p>
              {result.cappedAtMaxPaisa && (
                <p className="text-muted-foreground mt-1 text-xs">{t('cappedNote')}</p>
              )}
              {result.minimumAppliedPaisa && (
                <p className="text-muted-foreground mt-1 text-xs">{t('minimumNote')}</p>
              )}
              {result.reductionPercentApplied !== null && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('reductionNote', { percent: Math.round(result.reductionPercentApplied * 100) })}
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-xs">
                {t('rulesVersion', { version: result.rulesVersion ?? '—' })}
              </p>
            </>
          ) : (
            <p className="text-warning">{result.blockedReason ?? t('unavailable')}</p>
          )}
        </div>
      )}

      <p className="text-muted-foreground mt-3 text-xs">{t('disclaimer')}</p>
    </section>
  )
}
