'use client'

import { Button } from '@taxdesk/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { createTaxYear, fetchClientTaxYears } from '@/lib/api/taxYears'
import { useAuthStore } from '@/stores/authStore'

export function TaxYearList({ clientId }: { clientId: string }) {
  const t = useTranslations('taxYears')
  const { locale } = useParams<{ locale: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)

  const [items, setItems] = useState<
    Array<{ id: string; taxYear: number; status: string; rulesVersion: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()))
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!accessToken || sessionState !== 'full') return
    setLoading(true)
    try {
      const data = await fetchClientTaxYears(accessToken, clientId)
      setItems(data.items)
    } finally {
      setLoading(false)
    }
  }, [accessToken, sessionState, clientId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setCreating(true)
    try {
      await createTaxYear(accessToken, clientId, { taxYear: Number(newYear) })
      await load()
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div className="bg-surface-hover h-24 animate-pulse rounded-lg" aria-busy="true" />
  }

  return (
    <section aria-labelledby="tax-years-heading" className="border-border rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="tax-years-heading" className="text-lg font-medium">
          {t('title')}
        </h2>
        <form onSubmit={(e) => void handleCreate(e)} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="new-tax-year">
            {t('newYearLabel')}
          </label>
          <input
            id="new-tax-year"
            type="number"
            min={2020}
            max={2099}
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            className="border-border bg-surface w-24 rounded-md border px-2 py-1 text-sm"
          />
          <Button type="submit" size="sm" disabled={creating}>
            {t('create')}
          </Button>
        </form>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">{t('empty')}</p>
      ) : (
        <ul className="divide-border mt-4 divide-y" role="list">
          {items.map((ty) => (
            <li key={ty.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <Link
                  href={`/${locale}/tax-years/${ty.id}`}
                  className="text-primary font-medium underline"
                >
                  {t('yearLabel', { year: ty.taxYear })}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {t(`status.${ty.status}`)}
                  {ty.rulesVersion ? ` · ${t('rulesVersion', { version: ty.rulesVersion })}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
