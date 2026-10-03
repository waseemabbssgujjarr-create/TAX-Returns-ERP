'use client'

import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { fetchAdminSessions, revokeAdminSession } from '@/lib/api/admin'
import { useAuthStore } from '@/stores/authStore'

export function AdminSessionsClient() {
  const t = useTranslations('admin.sessions')
  const accessToken = useAuthStore((s) => s.accessToken)
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchAdminSessions>>['items']>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const page = await fetchAdminSessions(accessToken)
      setItems(page.items)
      setError(null)
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, t])

  useEffect(() => {
    void load()
  }, [load])

  async function onRevoke(id: string) {
    if (!accessToken) return
    if (!window.confirm(t('revokeConfirm'))) return
    try {
      await revokeAdminSession(accessToken, id, { reason: 'owner_revoke_ui' })
      await load()
    } catch {
      setError(t('errors.revokeFailed'))
    }
  }

  if (loading)
    return <div className="bg-surface-hover h-32 animate-pulse rounded-lg" aria-busy="true" />

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('hint')}</p>
      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}
      <ul className="space-y-2" role="list">
        {items.map((s) => (
          <li
            key={s.id}
            className="border-border bg-surface-subtle/40 rounded-md border p-3 text-sm shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {s.userName} ({s.userEmail})
                </p>
                <p className="text-muted-foreground">
                  {s.ipAddress ?? '—'} · {s.userAgent ?? '—'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {s.isActive ? t('active') : t('inactive')} · {s.createdAt}
                </p>
              </div>
              {s.isActive && (
                <Button variant="destructive" size="sm" onClick={() => void onRevoke(s.id)}>
                  {t('revoke')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
