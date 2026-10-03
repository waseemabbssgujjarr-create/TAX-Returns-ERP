'use client'

import { cn } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'

const INTEGRATIONS = [
  { key: 'filingExport', status: 'stub' as const },
  { key: 'iris', status: 'stub' as const },
  { key: 'payment', status: 'stub' as const },
  { key: 'objectStorage', status: 'live' as const },
  { key: 'aiExtraction', status: 'live' as const },
]

export function AdminIntegrationsClient() {
  const t = useTranslations('admin.integrations')
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('hint')}</p>
      <ul className="grid gap-3 sm:grid-cols-2" role="list">
        {INTEGRATIONS.map((i) => (
          <li
            key={i.key}
            className="border-border bg-surface-subtle/40 rounded-md border p-4 text-sm shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-foreground font-medium">{t(`items.${i.key}.name`)}</p>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  i.status === 'live'
                    ? 'bg-success-subtle text-success'
                    : 'bg-warning-subtle text-warning',
                )}
              >
                {t(`status.${i.status}`)}
              </span>
            </div>
            <p className="text-muted-foreground mt-2">{t(`items.${i.key}.detail`)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
