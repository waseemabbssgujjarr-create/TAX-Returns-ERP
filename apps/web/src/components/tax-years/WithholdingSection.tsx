'use client'

import {
  WithholdingReviewStatusSchema,
  WithholdingSourceSchema,
  type WithholdingChecklistSchema,
  type WithholdingEntrySchema,
} from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import type { z } from 'zod'

import {
  createWithholdingEntry,
  fetchWithholdingChecklist,
  fetchWithholdingEntries,
  reconcileWithholding,
  updateWithholdingEntry,
} from '@/lib/api/withholding'

type Entry = z.infer<typeof WithholdingEntrySchema>
type Checklist = z.infer<typeof WithholdingChecklistSchema>

function rupeesToPaisa(rupees: string): string {
  const cleaned = rupees.replace(/,/g, '').trim()
  if (!cleaned || Number.isNaN(Number(cleaned))) return '0'
  return String(BigInt(Math.round(Number(cleaned) * 100)))
}

function formatPkr(paisa: string): string {
  return `PKR ${(Number(BigInt(paisa)) / 100).toLocaleString()}`
}

function validationTone(status: string): string {
  if (status === 'VALID') return 'text-success'
  if (status === 'NOT_CHECKED') return 'text-muted-foreground'
  return 'text-error'
}

export function WithholdingSection({
  taxYearFileId,
  accessToken,
}: {
  taxYearFileId: string
  accessToken: string
}) {
  const t = useTranslations('taxYears.withholding')
  const [items, setItems] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState<(typeof WithholdingSourceSchema.options)[number]>('SALARY')
  const [amount, setAmount] = useState('')
  const [taxDeducted, setTaxDeducted] = useState('')
  const [certificateRef, setCertificateRef] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [payeeName, setPayeeName] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [whtCode, setWhtCode] = useState('')
  const [exemptionCode, setExemptionCode] = useState('')
  const [unmatched, setUnmatched] = useState<number | null>(null)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await fetchWithholdingEntries(accessToken, taxYearFileId)
      setItems(page.items)
      setError(null)
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, taxYearFileId, t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate() {
    setSaving(true)
    try {
      await createWithholdingEntry(accessToken, taxYearFileId, {
        source,
        amountPaisa: rupeesToPaisa(amount),
        taxDeductedPaisa: rupeesToPaisa(taxDeducted),
        ...(certificateRef.trim() ? { certificateRef: certificateRef.trim() } : {}),
        ...(documentId.trim() ? { documentId: documentId.trim() } : {}),
        ...(registrationNo.trim() ? { registrationNo: registrationNo.trim() } : {}),
        ...(payeeName.trim() ? { payeeName: payeeName.trim() } : {}),
        ...(transactionDate ? { transactionDate: new Date(transactionDate).toISOString() } : {}),
        ...(whtCode.trim() ? { whtCode: whtCode.trim() } : {}),
        ...(exemptionCode.trim() ? { exemptionCode: exemptionCode.trim() } : {}),
        reviewStatus: 'NOT_STARTED',
      })
      setAmount('')
      setTaxDeducted('')
      setCertificateRef('')
      setDocumentId('')
      setRegistrationNo('')
      setPayeeName('')
      setTransactionDate('')
      setWhtCode('')
      setExemptionCode('')
      await load()
    } catch {
      setError(t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function setReview(entryId: string, reviewStatus: string) {
    const parsed = WithholdingReviewStatusSchema.safeParse(reviewStatus)
    if (!parsed.success) return
    await updateWithholdingEntry(accessToken, entryId, { reviewStatus: parsed.data })
    await load()
  }

  async function setCpr(entryId: string, cprReference: string) {
    await updateWithholdingEntry(accessToken, entryId, {
      cprReference: cprReference.trim() ? cprReference.trim() : null,
    })
    await load()
  }

  async function handleReconcile() {
    setSaving(true)
    try {
      const result = await reconcileWithholding(accessToken, taxYearFileId)
      setItems(result.entries)
      setUnmatched(result.unmatchedCount)
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckReadiness() {
    const result = await fetchWithholdingChecklist(accessToken, taxYearFileId)
    setChecklist(result)
  }

  if (loading) {
    return <div className="bg-surface-hover h-24 animate-pulse rounded-lg" aria-busy="true" />
  }

  return (
    <section className="border-border rounded-lg border p-4" aria-labelledby="wht-heading">
      <h2 id="wht-heading" className="text-lg font-medium">
        {t('title')}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">{t('editorHint')}</p>

      {error && (
        <p className="text-error mt-2 text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('source')}</span>
          <select
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            value={source}
            onChange={(e) => setSource(WithholdingSourceSchema.parse(e.target.value))}
            disabled={saving}
          >
            {WithholdingSourceSchema.options.map((value) => (
              <option key={value} value={value}>
                {t(`sources.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('amount')}</span>
          <input
            className="border-border bg-surface w-full rounded-md border px-3 py-2 font-mono"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('taxDeducted')}</span>
          <input
            className="border-border bg-surface w-full rounded-md border px-3 py-2 font-mono"
            value={taxDeducted}
            onChange={(e) => setTaxDeducted(e.target.value)}
            inputMode="decimal"
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('certificate')}</span>
          <input
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            value={certificateRef}
            onChange={(e) => setCertificateRef(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('registrationNo')}</span>
          <input
            className="border-border bg-surface w-full rounded-md border px-3 py-2 font-mono"
            value={registrationNo}
            onChange={(e) => setRegistrationNo(e.target.value)}
            placeholder={t('registrationNoHint')}
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('payeeName')}</span>
          <input
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            value={payeeName}
            onChange={(e) => setPayeeName(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('transactionDate')}</span>
          <input
            type="date"
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('whtCode')}</span>
          <input
            className="border-border bg-surface w-full rounded-md border px-3 py-2 font-mono"
            value={whtCode}
            onChange={(e) => setWhtCode(e.target.value)}
            placeholder={t('whtCodeHint')}
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('exemptionCode')}</span>
          <input
            className="border-border bg-surface w-full rounded-md border px-3 py-2 font-mono"
            value={exemptionCode}
            onChange={(e) => setExemptionCode(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted-foreground mb-1 block">{t('documentId')}</span>
          <input
            className="border-border bg-surface w-full rounded-md border px-3 py-2 font-mono text-xs"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            placeholder={t('documentIdHint')}
            disabled={saving}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={saving || !amount} onClick={() => void handleCreate()}>
          {t('add')}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={() => void handleReconcile()}>
          {t('reconcile')}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={() => void handleCheckReadiness()}>
          {t('checkReadiness')}
        </Button>
      </div>

      {unmatched !== null && (
        <p className="text-warning mt-2 text-sm" role="status">
          {t('unmatched', { count: unmatched })}
        </p>
      )}

      {checklist && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            checklist.readyToSubmit
              ? 'border-success/40 bg-success/5'
              : 'border-warning/40 bg-warning/5'
          }`}
          role="status"
        >
          <p className="font-medium">
            {checklist.readyToSubmit ? t('checklist.ready') : t('checklist.notReady')}
          </p>
          {checklist.blockingReasons.map((reason) => (
            <p key={reason} className="text-muted-foreground mt-1 text-xs">
              {reason}
            </p>
          ))}
        </div>
      )}

      <ul className="divide-border border-border mt-4 divide-y rounded-lg border" role="list">
        {items.length === 0 ? (
          <li className="text-muted-foreground px-3 py-4 text-sm">{t('empty')}</li>
        ) : (
          items.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {t(`sources.${entry.source}`)} · {formatPkr(entry.amountPaisa)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('taxDeducted')}: {formatPkr(entry.taxDeductedPaisa)}
                  {entry.certificateRef ? ` · ${entry.certificateRef}` : ''}
                </p>
                {(entry.registrationNo || entry.payeeName || entry.whtCode) && (
                  <p className="text-muted-foreground text-xs">
                    {entry.payeeName ?? '—'} · {entry.registrationNo ?? '—'} · {t('whtCode')}:{' '}
                    {entry.whtCode ?? '—'}
                  </p>
                )}
                <p className="mt-1 text-xs">
                  {entry.matched ? (
                    <span className="text-success">{t('matched')}</span>
                  ) : (
                    <span className="text-warning">{t('discrepancy')}</span>
                  )}
                  {entry.documentId ? ` · ${t('hasEvidence')}` : ''}
                  {' · '}
                  <span className={validationTone(entry.validationStatus)}>
                    {t(`validationStatus.${entry.validationStatus}`)}
                  </span>
                  {entry.cprReference ? ` · ${t('cprOnFile')}` : ` · ${t('cprMissing')}`}
                </p>
                <label className="mt-2 block text-xs">
                  <span className="text-muted-foreground mb-1 block">{t('cprReference')}</span>
                  <input
                    className="border-border bg-surface w-48 rounded-md border px-2 py-1 font-mono text-xs"
                    defaultValue={entry.cprReference ?? ''}
                    onBlur={(e) => void setCpr(entry.id, e.target.value)}
                    placeholder={t('cprReferenceHint')}
                  />
                </label>
              </div>
              <select
                className="border-border bg-surface rounded-md border px-2 py-1 text-xs"
                value={entry.reviewStatus}
                onChange={(e) => void setReview(entry.id, e.target.value)}
                aria-label={t('review')}
              >
                {WithholdingReviewStatusSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {t(`reviewStatus.${value}`)}
                  </option>
                ))}
              </select>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
