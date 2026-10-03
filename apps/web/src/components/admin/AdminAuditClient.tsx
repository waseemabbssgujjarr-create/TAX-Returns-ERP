'use client'

import { Button, cn } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { staffInputClassName } from '@/components/staff/staffUi'
import { fetchAdminAuditLogs } from '@/lib/api/admin'
import { useAuthStore } from '@/stores/authStore'

export function AdminAuditClient({ actionPrefix }: { actionPrefix?: string }) {
  const t = useTranslations('admin.audit')
  const accessToken = useAuthStore((s) => s.accessToken)
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchAdminAuditLogs>>['items']>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [action, setAction] = useState(actionPrefix ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await fetchAdminAuditLogs(accessToken, {
        page,
        pageSize: 25,
        ...(action.trim() ? { action: action.trim() } : {}),
      })
      setItems(data.items)
      setTotalPages(data.totalPages)
      setError(null)
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, action, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('hint')}</p>
      <div className="flex flex-wrap gap-2">
        <input
          className={cn(staffInputClassName, 'mt-0 max-w-md')}
          value={action}
          onChange={(e) => {
            setPage(1)
            setAction(e.target.value)
          }}
          placeholder={t('actionFilter')}
          aria-label={t('actionFilter')}
        />
        <Button variant="secondary" onClick={() => void load()}>
          {t('refresh')}
        </Button>
      </div>
      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="bg-surface-hover h-32 animate-pulse rounded-lg" aria-busy="true" />
      ) : (
        <ul className="space-y-2 text-sm" role="list">
          {items.map((e) => (
            <li
              key={e.id}
              className="border-border bg-surface-subtle/40 rounded-md border p-3 shadow-sm"
            >
              <p className="font-medium">{e.action}</p>
              <p className="text-muted-foreground">
                {e.userName ?? e.userId ?? '—'} · {e.createdAt}
              </p>
              <p className="text-muted-foreground text-xs">
                {e.resourceType ?? '—'} {e.resourceId ?? ''} · {e.ipAddress ?? ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          {t('prev')}
        </Button>
        <span className="text-muted-foreground text-sm">
          {page}/{totalPages || 1}
        </span>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  )
}
