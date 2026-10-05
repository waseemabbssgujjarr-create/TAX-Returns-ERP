'use client'

import { useTranslations } from 'next-intl'

import { Link, usePathname } from '@/i18n/navigation'

const ITEMS = [
  { href: '/settings/storage' as const, labelKey: 'storage' as const },
  { href: '/admin/firm-settings' as const, labelKey: 'firm' as const },
]

export function SettingsSubNav() {
  const t = useTranslations('settings.subNav')
  const pathname = usePathname()

  return (
    <nav
      className="border-border bg-surface flex flex-wrap gap-2 rounded-lg border p-2 shadow-sm"
      aria-label={t('aria')}
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? 'bg-primary text-white hover:bg-primary-hover rounded-md px-3 py-1.5 text-sm font-medium no-underline'
                : 'text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-md px-3 py-1.5 text-sm font-medium no-underline'
            }
          >
            {t(item.labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
