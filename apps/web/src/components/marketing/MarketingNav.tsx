'use client'

import { Button, cn } from '@taxdesk/ui'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'

import { LanguageSwitcher } from '@/components/auth/LanguageSwitcher'
import { BrandLogo } from '@/components/marketing/BrandLogo'
import { Link } from '@/i18n/navigation'

const ANCHORS = [
  { href: '#platform', key: 'platform' as const },
  { href: '#features', key: 'features' as const },
  { href: '#how-it-works', key: 'howItWorks' as const },
  { href: '#security', key: 'security' as const },
  { href: '/contact', key: 'contact' as const, route: true },
]

export function MarketingNav() {
  const t = useTranslations('marketing.nav')
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const reduce = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header
      className={cn(
        'z-sticky sticky top-0 border-b transition-[background-color,box-shadow,border-color] duration-300',
        scrolled
          ? 'border-border/80 bg-surface/90 shadow-sm backdrop-blur-md'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="focus-visible:ring-primary shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label={t('homeAria')}
        >
          <BrandLogo size="sm" className="max-[380px]:[&>span]:hidden" />
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label={t('ariaLabel')}>
          {ANCHORS.map((a) =>
            'route' in a && a.route ? (
              <Link
                key={a.href}
                href={a.href as '/contact'}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-primary text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {t(a.key)}
              </Link>
            ) : (
              <a
                key={a.href}
                href={a.href}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-primary text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {t(a.key)}
              </a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden shrink-0 sm:inline-flex" />
          <div className="hidden items-center gap-2 lg:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t('signIn')}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">{t('getStarted')}</Link>
            </Button>
          </div>

          <button
            type="button"
            className="border-border text-foreground inline-flex h-11 w-11 items-center justify-center rounded-md border lg:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? t('closeMenu') : t('openMenu')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>

        <AnimatePresence>
          {open ? (
            <>
              <motion.button
                key="backdrop"
                type="button"
                aria-label={t('closeMenu')}
                className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-[2px] lg:hidden"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                {...(reduce ? {} : { exit: { opacity: 0 } })}
                transition={{ duration: reduce ? 0 : 0.2 }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                key="drawer"
                id={menuId}
                role="dialog"
                aria-modal="true"
                aria-label={t('ariaLabel')}
                className="border-border bg-surface mobile-drawer fixed end-3 top-[4.25rem] z-[70] flex flex-col overflow-hidden rounded-2xl border shadow-xl lg:hidden"
                initial={reduce ? false : { opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                {...(reduce ? {} : { exit: { opacity: 0, y: -10, scale: 0.96 } })}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 28, mass: 0.8 }
                }
              >
                <div className="border-border flex items-center justify-between border-b px-4 py-3">
                  <BrandLogo size="sm" />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md"
                    aria-label={t('closeMenu')}
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                  {ANCHORS.map((a) =>
                    'route' in a && a.route ? (
                      <Link
                        key={a.href}
                        href={a.href as '/contact'}
                        className="text-foreground hover:bg-surface-hover rounded-lg px-3 py-2.5 text-sm font-medium"
                        onClick={() => setOpen(false)}
                      >
                        {t(a.key)}
                      </Link>
                    ) : (
                      <a
                        key={a.href}
                        href={a.href}
                        className="text-foreground hover:bg-surface-hover rounded-lg px-3 py-2.5 text-sm font-medium"
                        onClick={() => setOpen(false)}
                      >
                        {t(a.key)}
                      </a>
                    ),
                  )}
                </nav>
                <div className="border-border mt-auto flex flex-col gap-2 border-t p-3">
                  <div className="flex items-center justify-between gap-2 px-1 sm:hidden">
                    <span className="text-muted-foreground text-xs font-medium">{t('language')}</span>
                    <LanguageSwitcher />
                  </div>
                  <Button asChild variant="secondary">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      {t('signIn')}
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup" onClick={() => setOpen(false)}>
                      {t('getStarted')}
                    </Link>
                  </Button>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  )
}
