'use client'



import type { AnalyticsOverview } from '@taxdesk/schemas'

import { Button, cn } from '@taxdesk/ui'

import {

  AlertCircle,

  CalendarClock,

  ClipboardList,

  FileStack,

  FileWarning,

  Receipt,

  TrendingUp,

  Users,

} from 'lucide-react'

import { useTranslations } from 'next-intl'

import { useCallback, useEffect, useMemo, useState } from 'react'



import { DashboardActivityChart } from '@/components/dashboard/DashboardActivityChart'

import { DashboardStatCard, TrendBadge } from '@/components/dashboard/DashboardStatCard'

import { DashboardTaxYearChart } from '@/components/dashboard/DashboardTaxYearChart'

import { StaffPanel } from '@/components/staff/StaffPanel'

import { Link } from '@/i18n/navigation'

import { fetchAnalyticsOverview } from '@/lib/api/analytics'

import { useAuthStore } from '@/stores/authStore'



function formatPkr(paisa: string): string {

  const n = BigInt(paisa)

  const rupees = n / BigInt(100)

  const frac = (n % BigInt(100)).toString().padStart(2, '0')

  return `${rupees.toLocaleString('en-PK')}.${frac}`

}



export function DashboardOverview() {

  const t = useTranslations('dashboard')

  const accessToken = useAuthStore((s) => s.accessToken)

  const sessionState = useAuthStore((s) => s.sessionState)



  const [data, setData] = useState<AnalyticsOverview | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)



  const load = useCallback(async () => {

    if (!accessToken || sessionState !== 'full') return

    setLoading(true)

    setError(null)

    try {

      setData(await fetchAnalyticsOverview(accessToken))

    } catch {

      setError(t('errors.loadFailed'))

    } finally {

      setLoading(false)

    }

  }, [accessToken, sessionState, t])



  useEffect(() => {

    void load()

  }, [load])



  const alertSummary = useMemo(() => {

    if (!data) return null

    return t('alertSummary', {

      deadlines: data.upcomingDeadlinesCount,

      pending: data.pendingDocuments,

    })

  }, [data, t])



  if (loading) {

    return (

      <div className="min-w-0 space-y-6" aria-busy="true" aria-live="polite">

        <div className="skeleton border-border h-12 rounded-lg border" />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">

          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (

            <div key={i} className="skeleton border-border h-32 rounded-lg border" />

          ))}

        </div>

        <div className="grid gap-4 lg:grid-cols-3">

          {[1, 2, 3].map((i) => (

            <div key={i} className="skeleton border-border h-56 rounded-lg border" />

          ))}

        </div>

      </div>

    )

  }



  if (error) {

    return (

      <StaffPanel className="text-center" role="alert">

        <p className="text-error text-sm">{error}</p>

        <Button type="button" variant="secondary" className="mt-4" onClick={() => void load()}>

          {t('errors.retry')}

        </Button>

      </StaffPanel>

    )

  }



  if (!data) {

    return (

      <StaffPanel className="border-dashed text-center">

        <p className="text-muted-foreground text-sm">{t('empty.description')}</p>

      </StaffPanel>

    )

  }



  const inProgress =

    (data.taxYearByStatus.IN_PROGRESS ?? 0) +

    (data.taxYearByStatus.UNDER_REVIEW ?? 0) +

    (data.taxYearByStatus.INTAKE ?? 0)



  const taskItems = buildTaskItems(data, t)



  return (

    <div className="min-w-0 space-y-6">

      {alertSummary ? (

        <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">

          <p className="text-muted-foreground flex min-w-0 items-start gap-2 text-sm">

            <AlertCircle className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />

            <span>{alertSummary}</span>

          </p>

          <Button asChild variant="link" size="sm" className="shrink-0 self-start sm:self-center">

            <Link href="/calendar">{t('panels.viewCalendar')}</Link>

          </Button>

        </div>

      ) : null}



      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">

        <DashboardStatCard

          label={t('metrics.activeClients')}

          value={String(data.activeClients)}

          icon={Users}

          trend={<TrendBadge variant="positive">{t('trends.portfolio')}</TrendBadge>}

        />

        <DashboardStatCard

          label={t('metrics.taxYearsInProgress')}

          value={String(inProgress)}

          icon={TrendingUp}

          iconClassName="bg-primary-subtle text-primary"

          trend={<TrendBadge variant="neutral">{t('trends.pipeline')}</TrendBadge>}

        />

        <DashboardStatCard

          label={t('metrics.pendingDocuments')}

          value={String(data.pendingDocuments)}

          icon={FileStack}

          iconClassName="bg-warning-subtle text-warning"

          trend={

            data.pendingDocuments > 0 ? (

              <TrendBadge variant="warning">{t('trends.actionNeeded')}</TrendBadge>

            ) : (

              <TrendBadge variant="positive">{t('trends.clear')}</TrendBadge>

            )

          }

        />

        <DashboardStatCard

          label={t('metrics.openNotices')}

          value={String(data.openNotices)}

          icon={FileWarning}

          iconClassName="bg-error-subtle text-error"

        />

        <DashboardStatCard

          label={t('metrics.pendingReviews')}

          value={String(data.pendingReviews)}

          icon={ClipboardList}

        />

        <DashboardStatCard

          label={t('metrics.upcomingDeadlines')}

          value={String(data.upcomingDeadlinesCount)}

          icon={CalendarClock}

        />

        <DashboardStatCard

          label={t('metrics.outstanding')}

          value={`PKR ${formatPkr(data.invoices.totalOutstandingPaisa)}`}

          icon={Receipt}

          subtext={t('metrics.collectedShort', {

            amount: formatPkr(data.invoices.totalCollectedPaisa),

          })}

        />

        <DashboardStatCard

          label={t('returnPrep.IN_REVIEW')}

          value={String(data.returnPrepByStatus.IN_REVIEW ?? 0)}

          icon={ClipboardList}

          iconClassName="bg-surface-subtle text-muted-foreground"

          subtext={t('returnPrepSub', {

            draft: data.returnPrepByStatus.DRAFT ?? 0,

            approved: data.returnPrepByStatus.APPROVED ?? 0,

          })}

        />

      </div>



      <div className="grid min-w-0 gap-4 lg:grid-cols-12">

        <StaffPanel className="min-w-0 lg:col-span-5">

          <div className="flex items-start justify-between gap-3">

            <h2 className="text-foreground text-sm font-semibold">{t('chart.taxYearTitle')}</h2>

          </div>

          <div className="mt-4">

            <DashboardTaxYearChart taxYearByStatus={data.taxYearByStatus} />

          </div>

        </StaffPanel>



        <StaffPanel className="min-w-0 lg:col-span-4">

          <h2 className="text-foreground text-sm font-semibold">{t('chart.activityTitle')}</h2>

          <p className="text-muted-foreground mt-1 text-xs">{t('chart.activityHint')}</p>

          <div className="mt-4">

            <DashboardActivityChart seedTotal={inProgress + data.pendingDocuments} />

          </div>

        </StaffPanel>



        <StaffPanel className="flex min-w-0 flex-col lg:col-span-3">

          <div className="bg-primary text-surface -mx-[var(--spacing-card)] -mt-[var(--spacing-card)] mb-4 rounded-t-lg px-[var(--spacing-card)] py-4">

            <p className="text-sm font-semibold">{t('cta.reviewReturns')}</p>

            <p className="text-white/85 mt-1 text-xs">{t('cta.reviewReturnsHint')}</p>

            <Button asChild size="sm" variant="secondary" className="mt-3 w-full">

              <Link href="/documents">{t('cta.openDocuments')}</Link>

            </Button>

          </div>

          <h2 className="text-foreground text-sm font-semibold">{t('sections.returnPrep')}</h2>

          <dl className="mt-3 space-y-2 text-sm">

            <StatRow label={t('returnPrep.DRAFT')} value={data.returnPrepByStatus.DRAFT ?? 0} />

            <StatRow label={t('returnPrep.IN_REVIEW')} value={data.returnPrepByStatus.IN_REVIEW ?? 0} />

            <StatRow label={t('returnPrep.APPROVED')} value={data.returnPrepByStatus.APPROVED ?? 0} />

          </dl>

        </StaffPanel>

      </div>



      <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">

        <StaffPanel className="min-w-0 xl:col-span-1">

          <div className="flex items-center justify-between gap-2">

            <h2 className="text-foreground text-sm font-semibold">{t('panels.tasks')}</h2>

            <Button asChild variant="link" size="sm">

              <Link href="/documents">{t('panels.viewAll')}</Link>

            </Button>

          </div>

          {taskItems.length === 0 ? (

            <p className="text-muted-foreground mt-4 text-sm">{t('panels.tasksEmpty')}</p>

          ) : (

            <ul className="mt-4 space-y-3" role="list">

              {taskItems.map((item) => (

                <li

                  key={item.key}

                  className="border-border flex gap-3 rounded-md border px-3 py-2.5 text-sm"

                >

                  <span

                    className={cn(

                      'mt-0.5 size-2 shrink-0 rounded-full',

                      item.tone === 'warning' ? 'bg-warning' : 'bg-primary',

                    )}

                    aria-hidden="true"

                  />

                  <div className="min-w-0 flex-1">

                    <p className="text-foreground font-medium">{item.title}</p>

                    <p className="text-muted-foreground text-xs">{item.detail}</p>

                  </div>

                </li>

              ))}

            </ul>

          )}

        </StaffPanel>



        <StaffPanel className="min-w-0 xl:col-span-1">

          <div className="flex items-center justify-between gap-2">

            <h2 className="text-foreground text-sm font-semibold">{t('sections.deadlines')}</h2>

            <Button asChild variant="link" size="sm">

              <Link href="/calendar">{t('panels.viewAll')}</Link>

            </Button>

          </div>

          {data.upcomingDeadlines.length === 0 ? (

            <p className="text-muted-foreground mt-4 text-sm">{t('empty.noDeadlines')}</p>

          ) : (

            <ul className="mt-4 text-sm" role="list">

              {data.upcomingDeadlines.slice(0, 6).map((d) => (

                <li

                  key={`${d.kind}-${d.resourceId}`}

                  className="border-border flex justify-between gap-3 border-b py-2 last:border-0"

                >

                  <span className="text-foreground min-w-0 truncate">{d.title}</span>

                  <time className="text-muted-foreground shrink-0 text-xs tabular-nums" dateTime={d.dueAt}>

                    {new Date(d.dueAt).toLocaleDateString()}

                  </time>

                </li>

              ))}

            </ul>

          )}

        </StaffPanel>



        <StaffPanel className="min-w-0 lg:col-span-2 xl:col-span-1">

          <h2 className="text-foreground text-sm font-semibold">{t('panels.upcomingFilings')}</h2>

          <p className="text-muted-foreground mt-1 text-xs">{t('panels.filingsHint')}</p>

          {inProgress === 0 ? (

            <p className="text-muted-foreground mt-4 text-sm">{t('panels.filingsEmpty')}</p>

          ) : (

            <ul className="mt-4 space-y-2 text-sm" role="list">

              {[

                { key: 'intake', count: data.taxYearByStatus.INTAKE ?? 0, label: t('taxYearStatus.INTAKE') },

                {

                  key: 'progress',

                  count: data.taxYearByStatus.IN_PROGRESS ?? 0,

                  label: t('taxYearStatus.IN_PROGRESS'),

                },

                {

                  key: 'review',

                  count: data.taxYearByStatus.UNDER_REVIEW ?? 0,

                  label: t('taxYearStatus.UNDER_REVIEW'),

                },

              ]

                .filter((row) => row.count > 0)

                .map((row) => (

                  <li key={row.key} className="flex items-center justify-between gap-3">

                    <span className="text-muted-foreground">{row.label}</span>

                    <span className="text-foreground font-medium tabular-nums">{row.count}</span>

                  </li>

                ))}

            </ul>

          )}

        </StaffPanel>

      </div>



      {data.staffWorkload.length > 0 ? (

        <StaffPanel className="min-w-0 overflow-hidden">

          <h2 className="text-foreground text-sm font-semibold">{t('sections.workload')}</h2>

          <div className="mt-4 -mx-[var(--spacing-card)] overflow-x-auto px-[var(--spacing-card)]">

            <table className="min-w-full text-sm">

              <thead className="text-muted-foreground text-start">

                <tr>

                  <th className="pb-2 pe-4 font-medium">{t('workload.assignee')}</th>

                  <th className="pb-2 pe-4 font-medium">{t('workload.taxYears')}</th>

                  <th className="pb-2 font-medium">{t('workload.notices')}</th>

                </tr>

              </thead>

              <tbody>

                {data.staffWorkload.map((row) => (

                  <tr key={row.userId ?? 'unassigned'} className="border-border border-t">

                    <td className="py-2 pe-4">{row.name}</td>

                    <td className="py-2 pe-4 tabular-nums">{row.openTaxYears}</td>

                    <td className="py-2 tabular-nums">{row.openNotices}</td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </StaffPanel>

      ) : null}

    </div>

  )

}



function StatRow({ label, value }: { label: string; value: number }) {

  return (

    <div className="flex justify-between gap-4">

      <dt className="text-muted-foreground">{label}</dt>

      <dd className="font-medium tabular-nums">{value}</dd>

    </div>

  )

}



function buildTaskItems(

  data: AnalyticsOverview,

  t: ReturnType<typeof useTranslations<'dashboard'>>,

) {

  const items: { key: string; title: string; detail: string; tone: 'warning' | 'primary' }[] = []



  if (data.pendingDocuments > 0) {

    items.push({

      key: 'docs',

      title: t('tasks.reviewDocuments'),

      detail: t('tasks.reviewDocumentsDetail', { count: data.pendingDocuments }),

      tone: 'warning',

    })

  }

  if (data.pendingReviews > 0) {

    items.push({

      key: 'reviews',

      title: t('tasks.pendingReviews'),

      detail: t('tasks.pendingReviewsDetail', { count: data.pendingReviews }),

      tone: 'primary',

    })

  }

  if ((data.returnPrepByStatus.IN_REVIEW ?? 0) > 0) {

    items.push({

      key: 'returns',

      title: t('tasks.returnsInReview'),

      detail: t('tasks.returnsInReviewDetail', {

        count: data.returnPrepByStatus.IN_REVIEW ?? 0,

      }),

      tone: 'primary',

    })

  }

  if (data.openNotices > 0) {

    items.push({

      key: 'notices',

      title: t('tasks.openNotices'),

      detail: t('tasks.openNoticesDetail', { count: data.openNotices }),

      tone: 'warning',

    })

  }



  return items.slice(0, 5)

}


