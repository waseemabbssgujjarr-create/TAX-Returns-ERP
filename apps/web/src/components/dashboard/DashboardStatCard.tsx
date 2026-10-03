import { cn } from '@taxdesk/ui'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  trend,
  subtext,
}: {
  label: string
  value: string
  icon: LucideIcon
  iconClassName?: string
  trend?: ReactNode
  subtext?: string
}) {
  return (
    <div className="border-border bg-surface flex min-w-0 flex-col gap-2 rounded-lg border p-3 shadow-sm sm:gap-3 sm:p-5">
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10',
            iconClassName ?? 'bg-primary-subtle text-primary',
          )}
        >
          <Icon className="size-4 sm:size-5" aria-hidden="true" />
        </span>
        {trend ? <div className="max-w-[45%] shrink-0 sm:max-w-none">{trend}</div> : null}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground line-clamp-2 text-xs leading-snug sm:truncate sm:text-sm">{label}</p>
        <p className="text-foreground mt-0.5 text-xl font-semibold tabular-nums tracking-tight sm:mt-1 sm:text-2xl">
          {value}
        </p>
        {subtext ? <p className="text-muted-foreground mt-1 text-xs">{subtext}</p> : null}
      </div>
    </div>
  )
}

export function TrendBadge({
  children,
  variant = 'positive',
}: {
  children: ReactNode
  variant?: 'positive' | 'neutral' | 'warning'
}) {
  const styles =
    variant === 'positive'
      ? 'bg-success-subtle text-success'
      : variant === 'warning'
        ? 'bg-warning-subtle text-warning'
        : 'bg-surface-subtle text-muted-foreground'

  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', styles)}>
      {children}
    </span>
  )
}
