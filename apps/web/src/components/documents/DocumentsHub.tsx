'use client'

import type { ClientSummary } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchClients } from '@/lib/api/clients'
import { useAuthStore } from '@/stores/authStore'

function taxYearOptions(fromYear: number, count = 6): number[] {
  return Array.from({ length: count }, (_, i) => fromYear - i)
}

export function DocumentsHub() {
  const t = useTranslations('documents.hub')
  const { locale } = useParams<{ locale: string }>()
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)

  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [taxYear, setTaxYear] = useState(() => new Date().getFullYear())

  const years = useMemo(() => taxYearOptions(new Date().getFullYear()), [])

  const load = useCallback(async () => {
    if (!accessToken || sessionState !== 'full') return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchClients(accessToken, {
        page: 1,
        pageSize: 100,
        archived: false,
        sortBy: 'displayName',
        sortDir: 'asc',
      })
      setClients(result.items)
      if (result.items.length === 1) {
        setClientId(result.items[0]!.id)
      }
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, sessionState, t])

  useEffect(() => {
    void load()
  }, [load])

  const openDocuments = () => {
    if (!clientId) return
    const params = new URLSearchParams({ clientId, taxYear: String(taxYear) })
    router.push(`/${locale}/documents?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="bg-surface-hover h-10 max-w-md animate-pulse rounded-md" />
        <div className="bg-surface-hover h-10 max-w-xs animate-pulse rounded-md" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-border rounded-lg border px-4 py-3" role="alert">
        <p className="text-error text-sm">{error}</p>
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
          {t('errors.retry')}
        </Button>
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed px-6 py-12 text-center">
        <p className="text-foreground font-medium">{t('noClients.title')}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t('noClients.description')}</p>
        <Button className="mt-4" asChild>
          <Link href={`/${locale}/clients/new`}>{t('noClients.action')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="border-border max-w-lg space-y-6 rounded-lg border p-6">
      <p className="text-muted-foreground text-sm">{t('description')}</p>

      <div className="space-y-2">
        <label htmlFor="documents-hub-client" className="text-foreground text-sm font-medium">
          {t('clientLabel')}
        </label>
        <select
          id="documents-hub-client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="border-border bg-surface w-full rounded-md border px-3 py-2 text-base"
        >
          <option value="">{t('clientPlaceholder')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="documents-hub-year" className="text-foreground text-sm font-medium">
          {t('taxYearLabel')}
        </label>
        <select
          id="documents-hub-year"
          value={taxYear}
          onChange={(e) => setTaxYear(Number(e.target.value))}
          className="border-border bg-surface w-full max-w-xs rounded-md border px-3 py-2 text-base"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <Button type="button" disabled={!clientId} onClick={openDocuments}>
        {t('continue')}
      </Button>
    </div>
  )
}
