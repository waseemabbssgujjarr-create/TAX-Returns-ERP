'use client'

import { cn } from '@taxdesk/ui'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'

import { isStaffNavActive } from '@/lib/nav/staffNavActive'
import { STAFF_NAV_ITEMS } from '@/lib/nav/staffNavItems'

/**
 * Hamburger + slide-over nav for staff shell on viewports below the desktop sidebar (lg).
 */
export function StaffMobileNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { locale } = useParams<{ locale: string }>()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      triggerRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="border-border text-foreground hover:bg-surface-hover inline-flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors lg:hidden"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? t('closeMenu') : t('openMenu')}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="staff-nav-backdrop"
              type="button"
              aria-label={t('closeMenu')}
              className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-[2px] lg:hidden"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              {...(reduce ? {} : { exit: { opacity: 0 } })}
              transition={{ duration: reduce ? 0 : 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              ref={panelRef}
              key="staff-nav-panel"
              id={menuId}
              role="dialog"
              aria-modal="true"
              aria-label={t('sidebarLabel')}
              tabIndex={-1}
              className="border-border bg-surface fixed inset-y-0 start-0 z-[70] flex w-[min(18rem,88vw)] flex-col border-e shadow-xl outline-none lg:hidden"
              initial={reduce ? false : { x: '-100%' }}
              animate={{ x: 0 }}
              {...(reduce ? {} : { exit: { x: '-100%' } })}
              transition={
                reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32, mass: 0.85 }
              }
            >
              <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
                <span className="text-foreground text-sm font-semibold">{t('sidebarLabel')}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md"
                  aria-label={t('closeMenu')}
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label={t('sidebarLabel')}>
                <ul className="flex flex-col gap-1" role="list">
                  {STAFF_NAV_ITEMS.map((item) => {
                    const href = `/${locale}/${item.href}` as Route
                    const isActive = isStaffNavActive(pathname, locale, item.href)
                    const Icon = item.icon

                    return (
                      <li key={item.href}>
                        <Link
                          href={href}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'staff-sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-colors',
                            isActive
                              ? 'bg-primary text-white hover:bg-primary-hover'
                              : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                          )}
                          onClick={() => setOpen(false)}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{t(item.labelKey)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
