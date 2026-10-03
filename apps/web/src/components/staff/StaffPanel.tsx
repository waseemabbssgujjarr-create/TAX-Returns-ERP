import { cn } from '@taxdesk/ui'
import type { HTMLAttributes } from 'react'

export function StaffPanel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-border bg-surface rounded-lg border shadow-sm',
        'p-[var(--spacing-card)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
