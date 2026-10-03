'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { LanguageSwitcher } from '@/components/auth/LanguageSwitcher'
import { fetchPortalHome } from '@/lib/api/staffLists'
import { useAuthStore } from '@/stores/authStore'

function formatPkr(paisa: string): string {
  const rupees = Number(BigInt(paisa) / BigInt(100))
  return `PKR ${rupees.toLocaleString()}`
}

export function PortalHomeClient() {
  const t = useTranslations('portal.home')
  const tReq = useTranslations('portal.requests')
  const { locale } = useParams<{ locale: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)
  const [home, setHome] = useState<Awaited<ReturnType<typeof fetchPortalHome>> | null>(null)

  useEffect(() => {
    if (!accessToken || sessionState !== 'full') return
    void fetchPortalHome(accessToken).then(setHome)
  }, [accessToken, sessionState])

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <LanguageSwitcher className="border-border bg-surface rounded-full border px-4 py-2 text-sm font-semibold" />
      </header>

      <section className="border-border bg-surface rounded-xl border p-4">
        <h2 className="font-medium">{tReq('title')}</h2>
        <ul className="mt-3 space-y-2 text-sm" role="list">
          {(home?.infoRequests ?? []).length === 0 ? (
            <li className="text-muted-foreground">{tReq('pending')}</li>
          ) : (
            home?.infoRequests.map((req) => (
              <li key={req.id} className="flex items-center justify-between gap-2">
                <span>{req.title}</span>
                <Link
                  href={`/${locale}/portal/documents`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {tReq('uploadAction')}
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="border-border bg-surface rounded-xl border p-4">
        <h2 className="font-medium">{t('documentsTitle')}</h2>
        <Link
          href={`/${locale}/portal/documents`}
          className="text-primary mt-2 inline-block text-sm underline-offset-2 hover:underline"
        >
          {tReq('uploadAction')}
        </Link>
      </section>

      {home?.actions.canViewBilling && (
        <section className="border-border bg-surface rounded-xl border p-4">
          <h2 className="font-medium">{t('invoicesTitle')}</h2>
          <ul className="mt-3 space-y-2 text-sm" role="list">
            {home.invoices.map((inv) => (
              <li key={inv.invoiceNumber} className="flex justify-between gap-2">
                <span>{inv.invoiceNumber}</span>
                <span>{formatPkr(inv.balancePaisa)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
