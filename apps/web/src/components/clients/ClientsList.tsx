'use client'

import type { ClientSummary } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { fetchClients } from '@/lib/api/clients'
import { useAuthStore } from '@/stores/authStore'

export function ClientsList() {
  const t = useTranslations('clients')
  const { locale } = useParams<{ locale: string }>()
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)

  const [items, setItems] = useState<ClientSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    if (!accessToken || sessionState !== 'full') return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchClients(accessToken, {
        page: 1,
        pageSize: 50,
        search: search || undefined,
        archived: showArchived,
        sortBy: 'displayName',
        sortDir: 'asc',
      })
      setItems(result.items)
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, sessionState, search, showArchived, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">{t('title')}</h1>
        </div>
        <Button asChild>
          <Link href={`/${locale}/clients/new`}>{t('newClient')}</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="border-border bg-surface w-full max-w-md rounded-md border px-3 py-2 text-base sm:flex-1"
          aria-label={t('searchPlaceholder')}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          {t('filters.showArchived')}
        </label>
      </div>

      {loading && (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-hover h-12 animate-pulse rounded-md" />
          ))}
        </div>
      )}

      {error && (
        <div className="border-border bg-surface rounded-lg border px-4 py-3" role="alert">
          <p className="text-error text-sm">{error}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void load()}
          >
            {t('errors.retry')}
          </Button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="border-border rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-foreground font-medium">{t('empty.title')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('empty.description')}</p>
          <Button className="mt-4" asChild>
            <Link href={`/${locale}/clients/new`}>{t('empty.action')}</Link>
          </Button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="border-border hidden overflow-x-auto rounded-lg border md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-hover text-start">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('columns.name')}</th>
                  <th className="px-4 py-3 font-medium">{t('columns.type')}</th>
                  <th className="px-4 py-3 font-medium">{t('columns.filerStatus')}</th>
                  <th className="px-4 py-3 font-medium">{t('columns.cnic')}</th>
                  <th className="px-4 py-3 font-medium">{t('columns.ntn')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((client) => (
                  <tr
                    key={client.id}
                    className="border-border hover:bg-surface-hover cursor-pointer border-t"
                    onClick={() => router.push(`/${locale}/clients/${client.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{client.displayName}</td>
                    <td className="px-4 py-3">{t(`type.${client.type}`)}</td>
                    <td className="px-4 py-3">{t(`filerStatus.${client.filerStatus}`)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{client.cnicMasked ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{client.ntnMasked ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden" role="list">
            {items.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/${locale}/clients/${client.id}`}
                  className="border-border bg-surface block rounded-lg border p-4 shadow-sm"
                >
                  <p className="text-foreground font-medium">{client.displayName}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t(`type.${client.type}`)} · {t(`filerStatus.${client.filerStatus}`)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
