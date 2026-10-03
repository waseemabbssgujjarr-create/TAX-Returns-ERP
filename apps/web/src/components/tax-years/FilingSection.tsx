'use client'

import type { IrisFilingDto } from '@taxdesk/schemas'
import { Button, cn } from '@taxdesk/ui'
import { AlertTriangle, CheckCircle2, History, Send, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import {
  fetchFiling,
  fetchFilingActivity,
  prepareFiling,
  recordManualIrisReference,
  refreshFilingStatus,
  submitFiling,
} from '@/lib/api/filing'
import { useAuthStore } from '@/stores/authStore'

type FilingActivity = Awaited<ReturnType<typeof fetchFilingActivity>>

const STATUS_TONE: Record<IrisFilingDto['status'], string> = {
  DRAFT: 'border-border text-muted-foreground bg-surface-subtle',
  READY: 'border-primary/40 text-primary bg-primary-subtle',
  PENDING_INTEGRATION: 'border-warning/40 text-warning bg-warning-subtle',
  SUBMITTED: 'border-success/40 text-success bg-success-subtle',
  ACCEPTED: 'border-success/40 text-success bg-success-subtle',
  REJECTED: 'border-destructive/40 text-destructive bg-destructive/10',
  FAILED: 'border-destructive/40 text-destructive bg-destructive/10',
}

export function FilingSection({
  taxYearFileId,
  accessToken,
}: {
  taxYearFileId: string
  accessToken: string
}) {
  const t = useTranslations('taxYears.filing')
  const role = useAuthStore((s) => s.user?.role)
  const canSubmitRole = role === 'OWNER' || role === 'MANAGER' || role === 'REVIEWER'

  const [row, setRow] = useState<IrisFilingDto | null>(null)
  const [activity, setActivity] = useState<FilingActivity>([])
  const [manualRef, setManualRef] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchFiling(accessToken, taxYearFileId)
      setRow(data)
      if (data) {
        setActivity(await fetchFilingActivity(accessToken, taxYearFileId))
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

  async function handlePrepare() {
    await withBusy(async () => {
      try {
        const data = await prepareFiling(accessToken, taxYearFileId)
        setRow(data)
        setStatusMsg(t('prepared'))
        setActivity(await fetchFilingActivity(accessToken, taxYearFileId))
      } catch {
        setError(t('errors.prepareFailed'))
      }
    })
  }

  async function handleSubmitViaAdapter() {
    await withBusy(async () => {
      try {
        const data = await submitFiling(accessToken, taxYearFileId, {})
        setRow(data)
        setStatusMsg(
          data.status === 'PENDING_INTEGRATION' ? t('pendingIntegrationNotice') : t('submitted'),
        )
        setActivity(await fetchFilingActivity(accessToken, taxYearFileId))
      } catch {
        setError(t('errors.submitFailed'))
      }
    })
  }

  async function handleRecordManual() {
    if (!manualRef.trim()) return
    await withBusy(async () => {
      try {
        const data = await recordManualIrisReference(accessToken, taxYearFileId, {
          irisReferenceNo: manualRef.trim(),
        })
        setRow(data)
        setManualRef('')
        setStatusMsg(t('manualRecorded'))
        setActivity(await fetchFilingActivity(accessToken, taxYearFileId))
      } catch {
        setError(t('errors.submitFailed'))
      }
    })
  }

  async function handleRefreshStatus() {
    await withBusy(async () => {
      try {
        const data = await refreshFilingStatus(accessToken, taxYearFileId)
        setRow(data)
        setStatusMsg(t('statusSynced'))
        setActivity(await fetchFilingActivity(accessToken, taxYearFileId))
      } catch {
        setError(t('errors.syncFailed'))
      }
    })
  }

  if (loading) {
    return (
      <div
        className="border-border bg-surface-hover h-32 animate-pulse rounded-xl border"
        aria-busy="true"
      />
    )
  }

  return (
    <section
      className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm"
      aria-labelledby="filing-heading"
    >
      <div className="border-border bg-surface-subtle/60 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Send className="text-primary size-5" aria-hidden="true" />
              <h2 id="filing-heading" className="text-foreground text-lg font-semibold">
                {t('title')}
              </h2>
              {row && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                    STATUS_TONE[row.status],
                  )}
                >
                  {t(`status.${row.status}`)}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t('hint')}</p>
          </div>
          <Button onClick={() => void handlePrepare()} disabled={busy}>
            {busy ? t('preparing') : t('prepareOrRefresh')}
          </Button>
        </div>

        <p className="border-warning/40 bg-warning-subtle text-foreground mt-3 rounded-lg border px-3 py-2 text-xs">
          {t('honestStateBanner')}
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
        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="text-primary size-4" aria-hidden="true" />
              {t('checklistTitle')}
            </h3>
            <ul className="space-y-2" aria-label={t('checklistTitle')}>
              {row.readiness.items.map((item) => (
                <li
                  key={item.code}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    item.ok
                      ? 'border-success/30 bg-success-subtle/40'
                      : item.severity === 'error'
                        ? 'border-destructive/40 bg-destructive/10'
                        : 'border-warning/40 bg-warning-subtle',
                  )}
                >
                  {item.ok ? (
                    <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle
                      className={cn(
                        'size-4 shrink-0',
                        item.severity === 'error' ? 'text-destructive' : 'text-warning',
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {row.status === 'PENDING_INTEGRATION' && row.errorMessage && (
            <p className="border-warning/40 bg-warning-subtle rounded-lg border px-3 py-2 text-sm">
              {row.errorMessage}
            </p>
          )}

          {canSubmitRole && (row.status === 'READY' || row.status === 'PENDING_INTEGRATION') && (
            <div className="border-border bg-surface-hover/40 space-y-4 rounded-lg border p-3">
              <div>
                <h3 className="text-sm font-semibold">{t('submitViaAdapterTitle')}</h3>
                <p className="text-muted-foreground mt-1 text-xs">{t('submitViaAdapterHint')}</p>
                <div className="mt-2">
                  <Button
                    variant="secondary"
                    disabled={busy || !row.readiness.readyToFile}
                    onClick={() => void handleSubmitViaAdapter()}
                  >
                    {t('submitViaAdapter')}
                  </Button>
                </div>
              </div>

              <div className="border-border border-t pt-3">
                <h3 className="text-sm font-semibold">{t('manualTitle')}</h3>
                <p className="text-muted-foreground mt-1 text-xs">{t('manualHint')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label htmlFor="iris-manual-ref" className="sr-only">
                    {t('manualRefLabel')}
                  </label>
                  <input
                    id="iris-manual-ref"
                    className="border-border bg-background min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
                    placeholder={t('manualRefPlaceholder')}
                    value={manualRef}
                    disabled={busy || !row.readiness.readyToFile}
                    onChange={(e) => setManualRef(e.target.value)}
                  />
                  <Button
                    disabled={busy || !manualRef.trim() || !row.readiness.readyToFile}
                    onClick={() => void handleRecordManual()}
                  >
                    {t('manualRecord')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(row.status === 'SUBMITTED' || row.status === 'ACCEPTED') && (
            <div className="border-border bg-surface-hover/40 space-y-2 rounded-lg border p-3 text-sm">
              <p>
                <span className="text-muted-foreground">{t('irisReferenceNo')}:</span>{' '}
                <span className="font-mono">{row.irisReferenceNo ?? '—'}</span>
              </p>
              {row.submittedAt && (
                <p className="text-muted-foreground text-xs">
                  {t('submittedAt')}: {new Date(row.submittedAt).toLocaleString()}
                </p>
              )}
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void handleRefreshStatus()}
              >
                {t('refreshStatus')}
              </Button>
            </div>
          )}

          {row.status === 'REJECTED' && row.errorMessage && (
            <p className="border-destructive/40 bg-destructive/10 rounded-lg border px-3 py-2 text-sm">
              {row.errorMessage}
            </p>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
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
        </div>
      )}
    </section>
  )
}
