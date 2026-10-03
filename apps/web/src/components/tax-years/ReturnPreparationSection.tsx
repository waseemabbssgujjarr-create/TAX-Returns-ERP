'use client'

import {
  ReturnPrepDraftV1Schema,
  type ReturnPrepActivityItem,
  type ReturnPrepFieldState,
  type ReturnPreparationSchema,
} from '@taxdesk/schemas'
import { Button, cn } from '@taxdesk/ui'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileWarning,
  History,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { z } from 'zod'

import { fetchExport, fetchExportDownloadUrl, requestExport } from '@/lib/api/exports'
import {
  approveReturnPrep,
  assembleReturnPrep,
  demoteReturnPrep,
  fetchReturnPrep,
  fetchReturnPrepActivity,
  submitReturnPrepReview,
  upsertReturnPrep,
} from '@/lib/api/returnPrep'
import { useAuthStore } from '@/stores/authStore'

type ReturnPreparation = z.infer<typeof ReturnPreparationSchema>

type PanelId = 'overview' | 'fields' | 'validation' | 'missing' | 'approval' | 'activity'

const FIELD_STATE_TONE: Record<ReturnPrepFieldState, string> = {
  entered: 'border-border text-muted-foreground bg-surface-subtle',
  extracted: 'border-warning/40 text-warning bg-warning-subtle',
  verified: 'border-success/40 text-success bg-success-subtle',
  calculated: 'border-primary/40 text-primary bg-primary-subtle',
  missing: 'border-destructive/40 text-destructive bg-destructive/10',
  needs_review: 'border-warning/50 text-warning bg-warning-subtle',
}

function ProgressRing({ value, total, label }: { value: number; total: number; label: string }) {
  const reduce = useReducedMotion()
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const r = 28
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div
      className="flex items-center gap-3"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} className="stroke-border fill-none" strokeWidth="6" />
        <motion.circle
          cx="36"
          cy="36"
          r={r}
          className="stroke-primary fill-none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0, 0, 0.2, 1] }}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div>
        <p className="text-foreground text-2xl font-semibold tabular-nums" aria-hidden="true">
          {pct}%
        </p>
        <p className="text-muted-foreground text-xs" aria-hidden="true">
          {value}/{total}
        </p>
      </div>
    </div>
  )
}

export function ReturnPreparationSection({
  taxYearFileId,
  accessToken,
}: {
  taxYearFileId: string
  accessToken: string
}) {
  const t = useTranslations('taxYears.returnPrep')
  const tDisclaimer = useTranslations('taxPlanning')
  const role = useAuthStore((s) => s.user?.role)
  const reduce = useReducedMotion()

  const [row, setRow] = useState<ReturnPreparation | null>(null)
  const [activity, setActivity] = useState<ReturnPrepActivityItem[]>([])
  const [notes, setNotes] = useState('')
  const [approvalComment, setApprovalComment] = useState('')
  const [panel, setPanel] = useState<PanelId>('overview')
  const [validationOpen, setValidationOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const canApproveRole = role === 'OWNER' || role === 'MANAGER' || role === 'REVIEWER'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchReturnPrep(accessToken, taxYearFileId)
      setRow(data)
      const draftNotes =
        data?.structuredJson && typeof data.structuredJson.notes === 'string'
          ? data.structuredJson.notes
          : ''
      setNotes(draftNotes)
      if (data) {
        const acts = await fetchReturnPrepActivity(accessToken, taxYearFileId)
        setActivity(acts)
      } else {
        setActivity([])
      }
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

  const draft = useMemo(() => {
    if (!row) return null
    const parsed = ReturnPrepDraftV1Schema.safeParse(row.structuredJson)
    return parsed.success ? parsed.data : null
  }, [row])

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true)
    setStatusMsg(null)
    try {
      await fn()
      setError(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleAssemble() {
    await withBusy(async () => {
      try {
        const data = await assembleReturnPrep(accessToken, taxYearFileId)
        setRow(data)
        setNotes(typeof data.structuredJson.notes === 'string' ? data.structuredJson.notes : '')
        setStatusMsg(t('assembled'))
        setPanel('overview')
        const acts = await fetchReturnPrepActivity(accessToken, taxYearFileId)
        setActivity(acts)
      } catch {
        setError(t('errors.assembleFailed'))
      }
    })
  }

  async function handleSaveNotes() {
    if (!row) return
    await withBusy(async () => {
      try {
        const data = await upsertReturnPrep(accessToken, taxYearFileId, { notes })
        setRow(data)
        setStatusMsg(t('notesSaved'))
      } catch {
        setError(t('errors.saveFailed'))
      }
    })
  }

  async function handleSubmit() {
    await withBusy(async () => {
      try {
        const data = await submitReturnPrepReview(accessToken, taxYearFileId)
        setRow(data)
        setStatusMsg(t('submitted'))
        const acts = await fetchReturnPrepActivity(accessToken, taxYearFileId)
        setActivity(acts)
      } catch {
        setError(t('errors.submitFailed'))
      }
    })
  }

  async function handleApprove() {
    await withBusy(async () => {
      try {
        const data = await approveReturnPrep(accessToken, taxYearFileId, {
          comment: approvalComment || undefined,
        })
        setRow(data)
        setStatusMsg(t('approved'))
        const acts = await fetchReturnPrepActivity(accessToken, taxYearFileId)
        setActivity(acts)
      } catch {
        setError(t('errors.approveFailed'))
      }
    })
  }

  async function handleDemote(target: 'DRAFT' | 'IN_REVIEW') {
    await withBusy(async () => {
      try {
        const data = await demoteReturnPrep(accessToken, taxYearFileId, {
          targetStatus: target,
          comment: approvalComment || undefined,
        })
        setRow(data)
        setStatusMsg(t('demoted'))
        const acts = await fetchReturnPrepActivity(accessToken, taxYearFileId)
        setActivity(acts)
      } catch {
        setError(t('errors.demoteFailed'))
      }
    })
  }

  async function handleExport(
    exportType: 'TAX_SUMMARY_PDF' | 'RETURN_WORKSHEET' | 'WEALTH_STATEMENT',
  ) {
    await withBusy(async () => {
      try {
        const artifact = await requestExport(accessToken, {
          exportType,
          taxYearFileId,
          locale: 'en',
        })
        let ready = artifact
        for (let i = 0; i < 20; i++) {
          if (ready.status === 'READY' || ready.status === 'FAILED') break
          await new Promise((r) => setTimeout(r, 250))
          ready = await fetchExport(accessToken, artifact.id)
        }
        if (ready.status !== 'READY') {
          setError(t('errors.exportFailed'))
          return
        }
        const dl = await fetchExportDownloadUrl(accessToken, ready.id)
        window.open(dl.url, '_blank', 'noopener,noreferrer')
        setStatusMsg(t('exportReady'))
      } catch {
        setError(t('errors.exportFailed'))
      }
    })
  }

  if (loading) {
    return (
      <div
        className="border-border bg-surface-hover h-40 animate-pulse rounded-xl border"
        aria-busy="true"
      />
    )
  }

  const navItems: { id: PanelId; label: string }[] = [
    { id: 'overview', label: t('nav.overview') },
    { id: 'fields', label: t('nav.fields') },
    { id: 'validation', label: t('nav.validation') },
    { id: 'missing', label: t('nav.missing') },
    { id: 'approval', label: t('nav.approval') },
    { id: 'activity', label: t('nav.activity') },
  ]

  return (
    <section
      className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm"
      aria-labelledby="return-prep-heading"
    >
      <div className="border-border bg-surface-subtle/60 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="text-primary size-5" aria-hidden="true" />
              <h2 id="return-prep-heading" className="text-foreground text-lg font-semibold">
                {t('title')}
              </h2>
              {row?.reviewStatus === 'APPROVED' && (
                <span className="border-success/40 bg-success-subtle text-success inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                  <Lock className="size-3" aria-hidden="true" />
                  {t('reviewStatus.APPROVED')}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t('editorHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleAssemble()}
              disabled={busy || row?.reviewStatus === 'APPROVED'}
            >
              <RefreshCw className={cn('size-4', busy && 'animate-spin')} aria-hidden="true" />
              {busy ? t('assembling') : t('assemble')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleExport('TAX_SUMMARY_PDF')}
              disabled={busy || !row}
            >
              {t('exportTaxSummary')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleExport('RETURN_WORKSHEET')}
              disabled={busy || !row}
            >
              {t('exportWorksheet')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleExport('WEALTH_STATEMENT')}
              disabled={busy || !row}
            >
              {t('exportWealth')}
            </Button>
          </div>
        </div>

        <p className="border-warning/40 bg-warning-subtle text-foreground mt-3 rounded-lg border px-3 py-2 text-xs">
          {t('notFilingBanner')}
        </p>
      </div>

      {(error || statusMsg) && (
        <div className="px-4 pt-3 sm:px-6" role={error ? 'alert' : 'status'}>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {statusMsg && !error && <p className="text-success text-sm">{statusMsg}</p>}
        </div>
      )}

      {!row && <p className="text-muted-foreground px-4 py-8 text-sm sm:px-6">{t('empty')}</p>}

      {row && (
        <div className="grid lg:grid-cols-[220px_1fr]">
          <nav
            className="border-border flex gap-1 overflow-x-auto border-b p-3 lg:flex-col lg:border-b-0 lg:border-e"
            aria-label={t('nav.aria')}
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'min-h-11 rounded-md px-3 py-2 text-start text-sm font-medium transition-colors',
                  panel === item.id
                    ? 'bg-primary-subtle text-primary'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                )}
                aria-current={panel === item.id ? 'page' : undefined}
                onClick={() => setPanel(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 p-4 sm:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={panel}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                {...(reduce ? {} : { exit: { opacity: 0, y: -6 } })}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0, 0, 0.2, 1] }}
              >
                {panel === 'overview' && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-6">
                      {draft ? (
                        <ProgressRing
                          value={draft.sectionCompleteness.complete}
                          total={draft.sectionCompleteness.total}
                          label={t('completeness')}
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm">{t('legacyDraft')}</p>
                      )}
                      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                          label={t('review')}
                          value={t(`reviewStatus.${row.reviewStatus}`)}
                        />
                        <StatCard
                          label={t('rulesState')}
                          value={draft ? t(`rulesStates.${draft.rulesState}`) : '—'}
                        />
                        <StatCard
                          label={t('wealth')}
                          value={
                            draft?.wealth?.present
                              ? `${draft.wealth.status ?? '—'} / ${draft.wealth.reviewStatus ?? '—'}`
                              : t('missing')
                          }
                        />
                        <StatCard
                          label={t('computation')}
                          value={draft?.computation?.status ?? t('missing')}
                        />
                      </div>
                    </div>

                    {draft && (
                      <ul className="grid gap-2 sm:grid-cols-2" aria-label={t('checklist')}>
                        {(
                          [
                            ['sectionsComplete', draft.checklist.sectionsComplete],
                            ['wealthReviewed', draft.checklist.wealthReviewed],
                            ['withholdingReconciled', draft.checklist.withholdingReconciled],
                            ['computationOk', draft.checklist.computationOk],
                            ['humanReviewRequired', draft.checklist.humanReviewRequired],
                          ] as const
                        ).map(([key, ok]) => (
                          <li
                            key={key}
                            className="border-border flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                          >
                            {ok ? (
                              <CheckCircle2 className="text-success size-4" aria-hidden="true" />
                            ) : (
                              <AlertTriangle className="text-warning size-4" aria-hidden="true" />
                            )}
                            <span>{t(`checklistItems.${key}`)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {panel === 'fields' && draft && (
                  <div className="space-y-3">
                    <h3 className="text-foreground text-sm font-semibold">{t('fieldsTitle')}</h3>
                    <p className="text-muted-foreground text-sm">{t('fieldsHint')}</p>
                    <ul className="divide-border border-border divide-y rounded-lg border">
                      {draft.fields.map((field) => (
                        <li
                          key={field.path}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                        >
                          <span className="text-foreground font-medium">{field.label}</span>
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                              FIELD_STATE_TONE[field.state],
                            )}
                          >
                            {t(`fieldState.${field.state}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {panel === 'validation' && draft && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      className="border-border flex w-full items-center justify-between rounded-lg border px-3 py-3 text-start"
                      aria-expanded={validationOpen}
                      onClick={() => setValidationOpen((v) => !v)}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="text-primary size-4" aria-hidden="true" />
                        {t('validationTitle')} — {t(`validationStatus.${draft.validation.status}`)}
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-4 transition-transform',
                          validationOpen && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {validationOpen && (
                      <ul className="space-y-2">
                        {draft.validation.issues.map((issue) => (
                          <li
                            key={`${issue.code}-${issue.path ?? ''}`}
                            className={cn(
                              'rounded-lg border px-3 py-2 text-sm',
                              issue.severity === 'error' &&
                                'border-destructive/40 bg-destructive/10 text-foreground',
                              issue.severity === 'warning' &&
                                'border-warning/40 bg-warning-subtle text-foreground',
                              issue.severity === 'info' && 'border-border bg-surface-subtle',
                            )}
                          >
                            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                              {issue.severity}
                            </span>
                            <p className="mt-0.5">{issue.message}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {draft.warnings.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">{t('warnings')}</h3>
                        <ul className="text-muted-foreground list-disc space-y-1 ps-5 text-sm">
                          {draft.warnings.map((w) => (
                            <li key={w.code}>{w.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {panel === 'missing' && draft && (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <FileWarning className="text-warning size-4" aria-hidden="true" />
                      {t('missingTitle')}
                    </h3>
                    {draft.missing.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{t('missingNone')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {draft.missing.map((item) => (
                          <li
                            key={item.path}
                            className="border-warning/40 bg-warning-subtle rounded-lg border px-3 py-2 text-sm"
                          >
                            <p className="text-foreground font-medium">{item.label}</p>
                            <p className="text-muted-foreground">{item.reason}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {panel === 'approval' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">{t('approvalTitle')}</h3>
                    <p className="text-muted-foreground text-sm">{t('approvalHint')}</p>

                    <div>
                      <label htmlFor="return-prep-notes" className="text-muted-foreground text-sm">
                        {t('notes')}
                      </label>
                      <textarea
                        id="return-prep-notes"
                        className="border-border bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        rows={3}
                        value={notes}
                        disabled={busy || row.reviewStatus === 'APPROVED'}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      <div className="mt-2">
                        <Button
                          variant="secondary"
                          onClick={() => void handleSaveNotes()}
                          disabled={busy || row.reviewStatus === 'APPROVED'}
                        >
                          {t('saveNotes')}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="approval-comment" className="text-muted-foreground text-sm">
                        {t('approvalComment')}
                      </label>
                      <textarea
                        id="approval-comment"
                        className="border-border bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        rows={2}
                        value={approvalComment}
                        disabled={busy}
                        onChange={(e) => setApprovalComment(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {row.reviewStatus === 'DRAFT' && (
                        <Button
                          onClick={() => void handleSubmit()}
                          disabled={busy || !draft?.validation.canSubmitForReview}
                        >
                          {t('submitReview')}
                        </Button>
                      )}
                      {row.reviewStatus === 'IN_REVIEW' && canApproveRole && (
                        <Button
                          onClick={() => void handleApprove()}
                          disabled={busy || !draft?.validation.canApprove}
                        >
                          {t('approve')}
                        </Button>
                      )}
                      {row.reviewStatus !== 'DRAFT' && (
                        <Button
                          variant="secondary"
                          onClick={() => void handleDemote('DRAFT')}
                          disabled={busy}
                        >
                          {t('demoteToDraft')}
                        </Button>
                      )}
                    </div>

                    {row.approvedAt && (
                      <p className="text-muted-foreground text-xs">
                        {t('approvedAt')}: {new Date(row.approvedAt).toLocaleString()}
                        {row.approvalComment ? ` — ${row.approvalComment}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {panel === 'activity' && (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <History className="text-primary size-4" aria-hidden="true" />
                      {t('activityTitle')}
                    </h3>
                    {activity.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{t('activityEmpty')}</p>
                    ) : (
                      <ol className="border-border space-y-2 border-s ps-4">
                        {activity.map((item) => (
                          <li key={item.id} className="relative text-sm">
                            <span className="bg-primary absolute -start-[21px] top-1.5 size-2.5 rounded-full" />
                            <p className="text-foreground font-medium">{item.action}</p>
                            <p className="text-muted-foreground text-xs">
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <p className="text-muted-foreground mt-8 text-xs">{tDisclaimer('disclaimer')}</p>
          </div>
        </div>
      )}
    </section>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-surface rounded-lg border px-3 py-2.5">
      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}
