'use client'

import type { TaxYearDetail, TaxYearSectionKey, DataProvenance } from '@taxdesk/schemas'
import {
  DataProvenanceSchema,
  TaxYearSectionKeySchema,
  TaxYearStatusSchema,
} from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { FilingSection } from './FilingSection'
import { ReturnPreparationSection } from './ReturnPreparationSection'
import { WealthStatementSection } from './WealthStatementSection'
import { WithholdingSection } from './WithholdingSection'

import { DocumentsList } from '@/components/documents/DocumentsList'
import { computeTaxYear, fetchTaxYear, updateTaxYear } from '@/lib/api/taxYears'
import { useAuthStore } from '@/stores/authStore'

function formatPkr(paisa: string | null): string {
  if (!paisa) return '—'
  const rupees = Number(BigInt(paisa) / BigInt(100))
  return `PKR ${rupees.toLocaleString()}`
}

const WORKSPACE_SECTIONS = TaxYearSectionKeySchema.options

function provenanceFor(
  sections: TaxYearDetail['sections'],
  key: TaxYearSectionKey,
): DataProvenance {
  const raw = sections[key] as { provenance?: string } | undefined
  const parsed = DataProvenanceSchema.safeParse(raw?.provenance)
  return parsed.success ? parsed.data : 'editable'
}

function isSectionComplete(sections: TaxYearDetail['sections'], key: TaxYearSectionKey): boolean {
  const raw = sections[key] as { complete?: boolean; fields?: Record<string, unknown> } | undefined
  if (!raw) return false
  if (raw.complete === true) return true
  return Boolean(raw.fields && Object.keys(raw.fields).length > 0)
}

function ProvenanceBadge({ provenance, label }: { provenance: DataProvenance; label: string }) {
  const tone =
    provenance === 'verified'
      ? 'border-success/40 text-success'
      : provenance === 'extracted'
        ? 'border-warning/40 text-warning'
        : provenance === 'calculated'
          ? 'border-primary/40 text-primary'
          : provenance === 'draft_rules'
            ? 'border-error/40 text-error'
            : 'border-border text-muted-foreground'
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  )
}

export function TaxYearWorkspace({ taxYearFileId }: { taxYearFileId: string }) {
  const t = useTranslations('taxYears')
  const { locale } = useParams<{ locale: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)

  const [file, setFile] = useState<TaxYearDetail | null>(null)
  const [computeResult, setComputeResult] = useState<Awaited<
    ReturnType<typeof computeTaxYear>
  > | null>(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<TaxYearSectionKey>('income')
  const [noteDraft, setNoteDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || sessionState !== 'full') return
    setLoading(true)
    try {
      const detail = await fetchTaxYear(accessToken, taxYearFileId)
      setFile(detail)
      const section = detail.sections[activeSection] as { note?: string } | undefined
      setNoteDraft(section?.note ?? '')
      setError(null)
    } catch {
      setError(t('errors.loadFailed'))
      setFile(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken, sessionState, taxYearFileId, activeSection, t])

  useEffect(() => {
    if (sessionState === 'unauthenticated') {
      setLoading(false)
      return
    }
    if (!accessToken || sessionState !== 'full') {
      // Keep skeleton until AuthSessionProvider hydrates the in-memory token from refresh cookie.
      setLoading(true)
      return
    }
    void load()
  }, [load, accessToken, sessionState])

  const completeness = useMemo(() => {
    if (!file) return { done: 0, total: WORKSPACE_SECTIONS.length, missing: WORKSPACE_SECTIONS }
    const missing = WORKSPACE_SECTIONS.filter((key) => !isSectionComplete(file.sections, key))
    return {
      done: WORKSPACE_SECTIONS.length - missing.length,
      total: WORKSPACE_SECTIONS.length,
      missing,
    }
  }, [file])

  const rulesDraft =
    computeResult?.status === 'RULES_UNAVAILABLE' ||
    (file?.rulesVersion?.toUpperCase().includes('DRAFT') ?? false)

  async function handleCompute() {
    if (!accessToken) return
    setComputing(true)
    try {
      setComputeResult(await computeTaxYear(accessToken, taxYearFileId))
      await load()
    } finally {
      setComputing(false)
    }
  }

  async function handleStatusChange(status: string) {
    if (!accessToken || !file) return
    const parsed = TaxYearStatusSchema.safeParse(status)
    if (!parsed.success) return
    setSaving(true)
    try {
      setFile(await updateTaxYear(accessToken, taxYearFileId, { status: parsed.data }))
    } finally {
      setSaving(false)
    }
  }

  async function markSection(opts: {
    complete?: boolean
    provenance?: DataProvenance
    note?: string
  }) {
    if (!accessToken || !file) return
    setSaving(true)
    try {
      const current = (file.sections[activeSection] as Record<string, unknown> | undefined) ?? {}
      const nextSections = {
        ...file.sections,
        [activeSection]: {
          ...current,
          ...(opts.complete !== undefined ? { complete: opts.complete } : {}),
          ...(opts.provenance !== undefined ? { provenance: opts.provenance } : {}),
          ...(opts.note !== undefined ? { note: opts.note } : {}),
          fields: (current['fields'] as Record<string, unknown> | undefined) ?? {},
        },
      }
      setFile(await updateTaxYear(accessToken, taxYearFileId, { sections: nextSections }))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !file) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="bg-surface-hover h-40 animate-pulse rounded-lg" />
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  const activePayload = file.sections[activeSection] as
    | { note?: string; complete?: boolean; provenance?: string }
    | undefined
  const activeProvenance = provenanceFor(file.sections, activeSection)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/clients/${file.clientId}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {t('backToClient')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {t('workspaceTitle', { year: file.taxYear })}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('reviewStatus')}</span>
            <select
              className="border-border bg-surface rounded-md border px-2 py-1"
              disabled={saving}
              value={file.status}
              onChange={(e) => void handleStatusChange(e.target.value)}
            >
              {TaxYearStatusSchema.options.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
          </label>
          {file.rulesVersion && (
            <span className="text-muted-foreground">
              {t('rulesVersion', { version: file.rulesVersion })}
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}

      {rulesDraft && (
        <div
          className="border-error/40 bg-error/5 rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          <p className="text-error font-medium">{t('rulesDraft.title')}</p>
          <p className="text-muted-foreground mt-1">{t('rulesDraft.description')}</p>
        </div>
      )}

      <section
        className="border-border rounded-lg border p-4"
        aria-labelledby="completeness-heading"
      >
        <h2 id="completeness-heading" className="text-lg font-medium">
          {t('completeness.title')}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('completeness.summary', { done: completeness.done, total: completeness.total })}
        </p>
        <div
          className="bg-surface-hover mt-3 h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-labelledby="completeness-heading"
          aria-valuenow={completeness.done}
          aria-valuemin={0}
          aria-valuemax={completeness.total}
        >
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${(completeness.done / completeness.total) * 100}%` }}
          />
        </div>
        {completeness.missing.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" role="list">
            {completeness.missing.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  className="border-warning/40 text-warning rounded-full border px-2 py-0.5 text-xs"
                  onClick={() => setActiveSection(key)}
                >
                  {t(`sections.${key}`)} — {t('completeness.missing')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-border rounded-lg border p-4">
        <h2 className="text-lg font-medium">{t('sections.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('provenance.legend')}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {WORKSPACE_SECTIONS.map((key) => {
            const done = isSectionComplete(file.sections, key)
            const provenance = provenanceFor(file.sections, key)
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection(key)
                    const section = file.sections[key] as { note?: string } | undefined
                    setNoteDraft(section?.note ?? '')
                  }}
                  className={`w-full rounded-md border px-3 py-2 text-start text-sm transition-colors ${
                    activeSection === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t(`sections.${key}`)}</span>
                    <ProvenanceBadge
                      provenance={provenance}
                      label={t(`provenance.${provenance}`)}
                    />
                  </span>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {done ? t('completeness.complete') : t('completeness.pending')}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="border-border bg-surface-hover/40 mt-4 space-y-3 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">{t(`sections.${activeSection}`)}</h3>
            <ProvenanceBadge
              provenance={activeProvenance}
              label={t(`provenance.${activeProvenance}`)}
            />
          </div>
          <p className="text-muted-foreground text-xs">{t('sections.editorHint')}</p>
          <label htmlFor="tax-year-section-notes" className="block text-sm">
            <span className="text-muted-foreground mb-1 block">{t('sections.notes')}</span>
            <textarea
              id="tax-year-section-notes"
              className="border-border bg-surface min-h-20 w-full rounded-md border px-3 py-2"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              disabled={saving}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() =>
                void markSection({
                  note: noteDraft,
                  provenance: 'editable',
                  complete: false,
                })
              }
            >
              {t('sections.saveDraft')}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() =>
                void markSection({
                  note: noteDraft,
                  provenance: 'verified',
                  complete: true,
                })
              }
            >
              {t('sections.markVerified')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() =>
                void markSection({
                  note: noteDraft,
                  provenance: 'extracted',
                  complete: Boolean(activePayload?.complete),
                })
              }
            >
              {t('sections.markExtracted')}
            </Button>
          </div>
        </div>
      </section>

      {accessToken && (
        <WealthStatementSection taxYearFileId={taxYearFileId} accessToken={accessToken} />
      )}

      <section className="border-border rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">{t('supportingDocuments')}</h2>
        <DocumentsList clientId={file.clientId} taxYear={file.taxYear} showUpload compact={false} />
      </section>

      {accessToken && (
        <WithholdingSection taxYearFileId={taxYearFileId} accessToken={accessToken} />
      )}

      {accessToken && (
        <ReturnPreparationSection taxYearFileId={taxYearFileId} accessToken={accessToken} />
      )}

      {accessToken && <FilingSection taxYearFileId={taxYearFileId} accessToken={accessToken} />}

      <section className="border-border rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">{t('compute.title')}</h2>
          <Button onClick={() => void handleCompute()} disabled={computing}>
            {computing ? t('compute.running') : t('compute.run')}
          </Button>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{t('compute.calculatedHint')}</p>

        {computeResult && (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">{t('compute.status')}:</span>{' '}
              {computeResult.status}
              {computeResult.status === 'RULES_UNAVAILABLE' && (
                <span className="ms-2">
                  <ProvenanceBadge provenance="draft_rules" label={t('provenance.draft_rules')} />
                </span>
              )}
              {computeResult.status === 'SUCCESS' && (
                <span className="ms-2">
                  <ProvenanceBadge provenance="calculated" label={t('provenance.calculated')} />
                </span>
              )}
            </p>
            {computeResult.rulesVersion && (
              <p>
                <span className="text-muted-foreground">{t('rulesVersionLabel')}:</span>{' '}
                {computeResult.rulesVersion}
              </p>
            )}
            {computeResult.validationErrors.length > 0 && (
              <ul className="text-error list-disc ps-5" role="list">
                {computeResult.validationErrors.map((e) => (
                  <li key={e.code}>{e.message}</li>
                ))}
              </ul>
            )}
            {computeResult.warnings.length > 0 && (
              <ul className="text-warning list-disc ps-5" role="list">
                {computeResult.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            )}
            {computeResult.taxPayablePaisa !== null && (
              <p className="font-medium">
                {t('compute.taxPayable', { amount: formatPkr(computeResult.taxPayablePaisa) })}
              </p>
            )}
            {computeResult.breakdown.length > 0 && (
              <div>
                <h3 className="font-medium">{t('compute.breakdown')}</h3>
                <ul className="mt-2 space-y-1 font-mono text-xs" role="list">
                  {computeResult.breakdown.map((node) => (
                    <li key={node.labelKey}>
                      {node.labelKey}: {formatPkr(node.valuePaisa)}
                      {node.note ? ` (${node.note})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
