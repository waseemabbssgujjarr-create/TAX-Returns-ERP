'use client'

import { cn } from '@taxdesk/ui'
import { useLocale, useTranslations } from 'next-intl'

import { Link, usePathname } from '@/i18n/navigation'
import { locales, type Locale } from '@/i18n/request'

const LOCALE_OPTIONS: { code: Locale; shortKey: 'englishShort' | 'urduShort'; ariaKey: 'englishAria' | 'urduAria' }[] =
  [
    { code: 'en', shortKey: 'englishShort', ariaKey: 'englishAria' },
    { code: 'ur', shortKey: 'urduShort', ariaKey: 'urduAria' },
  ]

const segmentClass =
  'focus-visible:ring-primary relative z-10 inline-flex min-h-9 min-w-[2.75rem] cursor-pointer items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

/** Full navigation avoids stale RSC/vendor chunks after dev hot reload. */
function localeHref(pathname: string, next: Locale): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return path === '/' ? `/${next}` : `/${next}${path}`
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const t = useTranslations('auth.languageSwitcher')
  const pathname = usePathname()

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn(
        'border-border bg-surface-subtle relative z-20 inline-flex items-center rounded-full border p-0.5 shadow-sm',
        className,
      )}
    >
      {LOCALE_OPTIONS.map(({ code, shortKey, ariaKey }) => {
        const active = locale === code
        const label = t(shortKey)

        if (active) {
          return (
            <span
              key={code}
              role="radio"
              aria-checked
              aria-label={t(ariaKey)}
              className={cn(segmentClass, 'bg-primary cursor-default text-white shadow-sm')}
            >
              {label}
            </span>
          )
        }

        return (
          <Link
            key={code}
            href={pathname}
            locale={code}
            replace
            prefetch={false}
            role="radio"
            aria-checked={false}
            aria-label={t(ariaKey)}
            title={t(ariaKey)}
            className={cn(
              segmentClass,
              'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            )}
            onClick={(event) => {
              // Hard navigation fallback when .next vendor chunks are out of sync (common in dev).
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              window.location.assign(localeHref(pathname, code))
            }}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

/** @internal exported for tests */
export function getNextLocale(current: Locale): Locale {
  const idx = locales.indexOf(current)
  return locales[(idx + 1) % locales.length] ?? 'en'
}
