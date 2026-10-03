'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { usePathname, useRouter } from '@/i18n/navigation'
import { getAuthMe, getProblemReason, postLogout, postRefresh } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/authStore'

const REFRESH_INTERVAL_MS = 12 * 60 * 1000
const IDLE_WARNING_LEAD_SEC = 120

/** Survives React Strict Mode remounts so hard-refresh bootstrap runs once per page load. */
let sessionBootstrapStarted = false

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/2fa',
  '/2fa-setup',
  '/recover',
  '/password-reset',
  '/portal/login',
])

function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.has(pathname)
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth.session')
  const router = useRouter()
  const pathname = usePathname()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)
  const tokenIat = useAuthStore((s) => s.tokenIat)
  const firm = useAuthStore((s) => s.firm)
  const setSessionFromMe = useAuthStore((s) => s.setSessionFromMe)
  const setToken = useAuthStore((s) => s.setToken)
  const clearToken = useAuthStore((s) => s.clearToken)

  const [idleDialogOpen, setIdleDialogOpen] = useState(false)
  const [sessionToast, setSessionToast] = useState<string | null>(null)

  useEffect(() => {
    // E2E / local diagnostics only — never ship auth state helpers to production builds.
    if (process.env.NODE_ENV === 'production') return
    ;(
      window as unknown as { __TAXDESK_AUTH_STORE__?: typeof useAuthStore }
    ).__TAXDESK_AUTH_STORE__ = useAuthStore
    return () => {
      delete (window as unknown as { __TAXDESK_AUTH_STORE__?: typeof useAuthStore })
        .__TAXDESK_AUTH_STORE__
    }
  }, [])

  const handleRefreshError = useCallback(
    (error: unknown) => {
      const reason = getProblemReason(error)
      const current = useAuthStore.getState()
      if (current.sessionState === 'partial' && current.accessToken) {
        return
      }

      clearToken()
      if (reason === 'idle_timeout') {
        setSessionToast(t('expired'))
        router.push('/login')
        return
      }
      if (sessionState === 'full' && !isPublicAuthPath(pathname)) {
        router.push('/login')
      }
    },
    [clearToken, pathname, router, sessionState, t],
  )

  const refreshSession = useCallback(async () => {
    const { accessToken: nextToken } = await postRefresh()
    setToken(nextToken)
    if (useAuthStore.getState().sessionState === 'full') {
      const me = await getAuthMe(nextToken)
      setSessionFromMe(nextToken, {
        user: me.user,
        firm: { name: me.firm.name, idleTimeoutMinutes: me.firm.idleTimeoutMinutes },
      })
    }
    return nextToken
  }, [setSessionFromMe, setToken])

  useEffect(() => {
    // Public auth screens have no session cookie yet — skip to avoid noisy 401s.
    if (isPublicAuthPath(pathname)) return
    if (sessionBootstrapStarted) return
    sessionBootstrapStarted = true
    void refreshSession().catch(handleRefreshError)
  }, [handleRefreshError, pathname, refreshSession])

  useQuery({
    queryKey: ['auth', 'refresh'],
    queryFn: refreshSession,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    enabled: sessionState === 'full',
    retry: false,
  })

  useEffect(() => {
    if (sessionState !== 'full' || !tokenIat || !firm) return

    const idleMinutes = firm.idleTimeoutMinutes > 0 ? firm.idleTimeoutMinutes : 30
    const expiryMs = (tokenIat + idleMinutes * 60) * 1000
    const warnAt = expiryMs - IDLE_WARNING_LEAD_SEC * 1000
    const delay = warnAt - Date.now()
    if (delay <= 0) return

    const timer = window.setTimeout(() => setIdleDialogOpen(true), delay)
    return () => window.clearTimeout(timer)
  }, [firm, sessionState, tokenIat])

  const staySignedIn = async () => {
    if (!accessToken) return
    try {
      const me = await getAuthMe(accessToken)
      setSessionFromMe(accessToken, {
        user: me.user,
        firm: { name: me.firm.name, idleTimeoutMinutes: me.firm.idleTimeoutMinutes },
      })
      setIdleDialogOpen(false)
    } catch {
      handleRefreshError(new Error('me failed'))
    }
  }

  const signOut = async () => {
    try {
      await postLogout(accessToken)
    } catch {
      /* ignore */
    }
    clearToken()
    setIdleDialogOpen(false)
    router.push('/login')
  }

  return (
    <>
      {children}

      {sessionToast ? (
        <div
          role="status"
          aria-live="polite"
          className="z-toast bg-surface fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] rounded-md px-4 py-3 text-sm shadow-lg md:inset-x-auto md:bottom-auto md:end-4 md:top-4"
        >
          {sessionToast}
        </div>
      ) : null}

      <Dialog.Root open={idleDialogOpen} onOpenChange={setIdleDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="z-modal fixed inset-0 bg-black/40" />
          <Dialog.Content className="z-modal bg-surface fixed start-1/2 top-1/2 w-[min(100%-2rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg p-6 shadow-lg focus:outline-none rtl:translate-x-1/2">
            <Dialog.Title className="text-lg font-semibold">{t('idleWarningTitle')}</Dialog.Title>
            <Dialog.Description className="text-muted-foreground mt-2 text-sm">
              {t('idleWarningBody')}
            </Dialog.Description>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => void signOut()}>
                {t('signOut')}
              </Button>
              <Button type="button" variant="primary" onClick={() => void staySignedIn()}>
                {t('staySignedIn')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
