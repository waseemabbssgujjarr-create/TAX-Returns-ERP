'use client'

import { Button } from '@taxdesk/ui'
import { ChevronDown, LogOut } from 'lucide-react'
import type { Route } from 'next'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { LanguageSwitcher } from '@/components/auth/LanguageSwitcher'
import { StaffMobileNav } from '@/components/layout/StaffMobileNav'
import { BrandLogo } from '@/components/marketing/BrandLogo'
import { Link } from '@/i18n/navigation'
import { postLogout } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/authStore'

/**
 * Staff app top bar.
 * Contains: logo, global search trigger (Cmd+K), notifications, user menu.
 * Full implementation in the Client CRM + Command Palette spec.
 */
export function AppTopBar() {
  const t = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const { locale } = useParams<{ locale: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const clearToken = useAuthStore((s) => s.clearToken)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const signOut = async () => {
    try {
      await postLogout(accessToken)
    } catch {
      /* ignore */
    }
    clearToken()
    setMenuOpen(false)
    router.push(`/${locale}/login`)
  }

  const displayName = user?.name?.trim() || user?.role || 'Staff'

  return (
    <header className="border-border bg-surface sticky top-0 z-[var(--z-sticky)] flex h-14 items-center gap-2 border-b px-4 shadow-sm sm:gap-3 sm:px-6">
      <StaffMobileNav />
      <Link
        href={'/dashboard' as Route}
        className="focus-visible:ring-primary shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        aria-label={t('dashboard')}
      >
        <BrandLogo size="sm" showWordmark className="max-sm:[&>span]:hidden" />
      </Link>

      <div className="flex-1" />

      <button
        type="button"
        aria-label={t('searchPlaceholder')}
        className="border-border bg-surface-subtle text-muted-foreground hover:bg-surface-hover hidden items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors sm:flex"
        onClick={() => {
          /* TODO: open command palette — implemented in CRM spec */
        }}
      >
        <span>{t('searchPlaceholder')}</span>
        <kbd className="border-border rounded border px-1.5 py-0.5 text-xs">⌘K</kbd>
      </button>

      <LanguageSwitcher className="ms-1 inline-flex shrink-0 sm:ms-3" />

      <div className="relative ms-3" ref={menuRef}>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={t('userMenu')}
          className="border-border hover:bg-surface-hover flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span
            className="bg-primary/20 flex size-8 items-center justify-center rounded-full text-xs font-semibold uppercase"
            aria-hidden="true"
          >
            {displayName.slice(0, 2)}
          </span>
          <span className="text-foreground hidden max-w-[8rem] truncate font-medium md:inline">
            {displayName}
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="border-border bg-surface absolute end-0 top-full z-50 mt-1 min-w-[10rem] rounded-md border py-1 shadow-lg"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="menuitem"
              className="text-foreground w-full justify-start gap-2 rounded-none px-3"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              {tAuth('logout')}
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
