'use client'

import { cn } from '@taxdesk/ui'
import type { Route } from 'next'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { ADMIN_NAV_ITEMS } from '@/lib/adminNav'

/**
 * Persistent secondary navigation for all /admin/* routes.
 */
export function AdminSubNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { locale } = useParams<{ locale: string }>()

  return (
    <div className="border-border bg-surface space-y-3 rounded-lg border p-4 shadow-sm">
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        {t('administration')}
      </p>
      <nav aria-label={t('adminSubNav')}>
        <ul className="flex flex-wrap gap-1.5" role="list">
          {ADMIN_NAV_ITEMS.map((item) => {
            const href = `/${locale}/admin/${item.segment}` as Route
            const isActive = pathname === href || pathname.startsWith(`${href}/`)

            return (
              <li key={item.segment}>
                <Link
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm font-medium no-underline transition-colors',
                    isActive
                      ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                      : 'border-transparent text-foreground hover:border-border hover:bg-canvas',
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
