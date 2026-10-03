'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { BrandLogo } from '@/components/marketing/BrandLogo'
import { Link } from '@/i18n/navigation'

const PRODUCT = [
  { href: '#features', key: 'features' as const },
  { href: '#platform', key: 'platform' as const },
  { href: '#how-it-works', key: 'howItWorks' as const },
  { href: '#security', key: 'security' as const },
]

const COMPANY = [
  { href: '/contact', key: 'contact' as const },
  { href: '/signup', key: 'signup' as const },
  { href: '/login', key: 'signIn' as const },
]

const LEGAL = [
  { href: '/privacy', key: 'privacy' as const },
  { href: '/terms', key: 'terms' as const },
]

export function MarketingFooter() {
  const t = useTranslations('marketing.footer')
  const year = new Date().getFullYear()

  return (
    <footer className="border-border bg-surface-subtle/80 overflow-x-hidden border-t">
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="grid min-w-0 grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))] lg:items-start lg:gap-x-8 lg:gap-y-0">
          <div className="col-span-3 flex min-w-0 flex-col gap-2.5 lg:col-span-1 lg:pe-4">
            <Link
              href="/"
              className="focus-visible:ring-primary w-fit rounded-md no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <BrandLogo size="md" />
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed lg:max-w-none">
              {t('description')}
            </p>
            <p className="text-primary text-xs font-semibold tracking-wide">{t('productLine')}</p>
          </div>

          <FooterCol title={t('product')}>
            {PRODUCT.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-primary text-sm no-underline transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  {t(link.key)}
                </a>
              </li>
            ))}
          </FooterCol>

          <FooterCol title={t('company')}>
            {COMPANY.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href as '/contact' | '/signup' | '/login'}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-primary text-sm no-underline transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </FooterCol>

          <FooterCol title={t('legal')}>
            {LEGAL.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href as '/privacy' | '/terms'}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-primary text-sm no-underline transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </FooterCol>
        </div>
      </div>

      <div className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t('rights', { year })}</p>
          <p>{t('builtFor')}</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <nav aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-foreground text-sm font-semibold">{title}</h2>
      <ul className="flex min-w-0 flex-col gap-1.5 break-words" role="list">
        {children}
      </ul>
    </nav>
  )
}
