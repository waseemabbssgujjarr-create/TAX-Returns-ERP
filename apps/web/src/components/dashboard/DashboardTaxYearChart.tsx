'use client'

import { useTranslations } from 'next-intl'

const SEGMENT_KEYS = ['FILED', 'UNDER_REVIEW', 'IN_PROGRESS', 'INTAKE'] as const

const COLORS: Record<(typeof SEGMENT_KEYS)[number], string> = {
  FILED: 'var(--color-success)',
  UNDER_REVIEW: 'var(--color-primary)',
  IN_PROGRESS: 'color-mix(in oklab, var(--color-primary) 65%, var(--color-warning))',
  INTAKE: 'var(--color-border-strong)',
}

export function DashboardTaxYearChart({
  taxYearByStatus,
}: {
  taxYearByStatus: Record<string, number>
}) {
  const t = useTranslations('dashboard.chart')
  const tStatus = useTranslations('dashboard.taxYearStatus')

  const segments = SEGMENT_KEYS.map((key) => ({
    key,
    value: taxYearByStatus[key] ?? 0,
    label: tStatus(key),
    color: COLORS[key],
  })).filter((s) => s.value > 0)

  const totalAll = SEGMENT_KEYS.reduce((sum, key) => sum + (taxYearByStatus[key] ?? 0), 0)
  const total = segments.reduce((sum, s) => sum + s.value, 0) || totalAll || 1

  let cumulative = 0
  const gradientStops = segments
    .map((s) => {
      const start = (cumulative / total) * 100
      cumulative += s.value
      const end = (cumulative / total) * 100
      return `${s.color} ${start}% ${end}%`
    })
    .join(', ')

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
      <div
        className="relative mx-auto size-36 shrink-0 rounded-full sm:mx-0"
        style={{
          background: segments.length
            ? `conic-gradient(${gradientStops})`
            : 'var(--color-surface-subtle)',
        }}
        role="img"
        aria-label={t('taxYearAria', { total: String(totalAll) })}
      >
        <div className="border-border bg-surface absolute inset-[18%] flex flex-col items-center justify-center rounded-full border shadow-inner">
          <span className="text-muted-foreground text-xs">{t('totalLabel')}</span>
          <span className="text-foreground text-xl font-semibold tabular-nums">
            {totalAll}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm" role="list">
        {SEGMENT_KEYS.map((key) => {
          const value = taxYearByStatus[key] ?? 0
          return (
            <li key={key} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[key] }}
                  aria-hidden="true"
                />
                <span className="truncate">{tStatus(key)}</span>
              </span>
              <span className="text-foreground font-medium tabular-nums">{value}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
