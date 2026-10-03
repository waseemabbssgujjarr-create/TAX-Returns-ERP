'use client'

import { useTranslations } from 'next-intl'

/** Illustrative weekly activity bars — derived from overview totals when live series unavailable. */
export function DashboardActivityChart({ seedTotal }: { seedTotal: number }) {
  const t = useTranslations('dashboard.chart')
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

  const base = Math.max(1, seedTotal)
  const heights = days.map((_, i) => {
    const wave = [0.45, 0.62, 0.78, 0.55, 0.88, 0.35, 0.28][i] ?? 0.5
    return Math.round(wave * Math.min(base * 8, 100))
  })
  const max = Math.max(...heights, 1)

  return (
    <div className="flex h-36 flex-col">
      <div className="flex flex-1 items-end justify-between gap-1.5 sm:gap-2" role="presentation">
        {days.map((day, i) => (
          <div key={day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className="bg-primary/85 w-full max-w-[2rem] rounded-t-md transition-[height]"
              style={{ height: `${(heights[i]! / max) * 100}%`, minHeight: '0.5rem' }}
              title={t(`days.${day}`)}
            />
          </div>
        ))}
      </div>
      <div className="text-muted-foreground mt-2 flex justify-between gap-1 text-[10px] sm:text-xs">
        {days.map((day) => (
          <span key={day} className="min-w-0 flex-1 truncate text-center">
            {t(`days.${day}`)}
          </span>
        ))}
      </div>
    </div>
  )
}
