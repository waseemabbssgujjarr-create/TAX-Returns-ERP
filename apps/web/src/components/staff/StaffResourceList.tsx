'use client'

import { Button } from '@taxdesk/ui'
import type { Route } from 'next'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { StaffPageHeader } from '@/components/staff/StaffPageHeader'
import { StaffPanel } from '@/components/staff/StaffPanel'
import { useAuthStore } from '@/stores/authStore'

type Fetcher = (token: string) => Promise<{ items: Array<Record<string, string | null>> }>

export function StaffResourceList({
  namespace,
  fetchItems,
  columns,
  emptyActionHref,
  emptyActionLabelKey = 'empty.action',
}: {
  namespace: 'notices' | 'calendar' | 'billing' | 'returns'
  fetchItems: Fetcher
  columns: Array<{ key: string; labelKey: string }>
  /** Optional CTA route segment after locale, e.g. `clients` */
  emptyActionHref?: string
  emptyActionLabelKey?: string
}) {
  const t = useTranslations(namespace)
  const { locale } = useParams<{ locale: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)
  const [items, setItems] = useState<Array<Record<string, string | null>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken || sessionState !== 'full') return
    void (async () => {
      setLoading(true)
      try {
        const res = await fetchItems(accessToken)
        setItems(res.items)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    })()
  }, [accessToken, sessionState, fetchItems])

  if (loading) {
    return <div className="bg-surface-hover h-32 animate-pulse rounded-lg shadow-sm" aria-busy="true" />
  }

  return (
    <div className="space-y-6">
      <StaffPageHeader title={t('title')} />
      {items.length === 0 ? (
        <StaffPanel className="border-dashed text-center">
          <p className="text-foreground font-medium">{t('empty.title')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('empty.description')}</p>
          {emptyActionHref ? (
            <Button className="mt-4" asChild>
              <Link href={`/${locale}/${emptyActionHref}` as Route}>{t(emptyActionLabelKey)}</Link>
            </Button>
          ) : null}
        </StaffPanel>
      ) : (
        <StaffPanel className="p-0">
          <ul className="divide-border divide-y" role="list">
            {items.map((item) => (
              <li
                key={String(item.id)}
                className="hover:bg-surface-hover/50 grid gap-2 px-4 py-3 text-sm transition-colors sm:grid-cols-3"
              >
                {columns.map((col) => (
                  <span key={col.key}>
                    <span className="text-muted-foreground">{t(col.labelKey)}: </span>
                    {item[col.key] ?? '—'}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </StaffPanel>
      )}
    </div>
  )
}
