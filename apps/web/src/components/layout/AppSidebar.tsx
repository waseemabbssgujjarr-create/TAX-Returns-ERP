'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { isStaffNavActive } from '@/lib/nav/staffNavActive'
import { STAFF_NAV_ITEMS } from '@/lib/nav/staffNavItems'

/**
 * Staff app sidebar.
 * - Desktop: persistent, shows icon + label
 * - Tablet: collapsible to icon-only rail
 * - Phone / tablet: hidden (hamburger slide-over — see StaffMobileNav)
 *
 * Full collapse behaviour and keyboard shortcut wiring done in CRM spec.
 */
export function AppSidebar() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { locale } = useParams<{ locale: string }>()

  return (
    <nav
      aria-label={t('sidebarLabel')}
      className="border-border bg-surface hidden w-56 shrink-0 flex-col border-e lg:flex"
    >
      <ul className="flex flex-col gap-1 p-3" role="list">
        {STAFF_NAV_ITEMS.map((item) => {
          const href = `/${locale}/${item.href}` as Route
          const isActive = isStaffNavActive(pathname, locale, item.href)
          const Icon = item.icon

          return (
            <li key={item.href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'staff-sidebar-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors',
                  isActive
                    ? 'bg-primary text-white hover:bg-primary-hover'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                ].join(' ')}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t(item.labelKey)}</span>
                {item.shortcut && (
                  <kbd
                    className={[
                      'ms-auto hidden rounded border px-1 py-0.5 text-[10px] xl:block',
                      isActive ? 'border-white/30 text-white/70' : 'border-border text-muted-foreground',
                    ].join(' ')}
                  >
                    {item.shortcut}
                  </kbd>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
