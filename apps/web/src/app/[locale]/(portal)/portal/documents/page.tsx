'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { DocumentsList } from '@/components/documents/DocumentsList'
import { useAuthStore } from '@/stores/authStore'

export default function PortalDocumentsPage() {
  const t = useTranslations('documents')
  const searchParams = useSearchParams()
  const clientId = useAuthStore((s) => s.clientId)
  const taxYearParam = searchParams.get('taxYear')
  const taxYear = taxYearParam ? Number(taxYearParam) : new Date().getFullYear()

  if (!clientId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-semibold">{t('portal.title')}</h1>
        <p className="text-muted-foreground mt-4">{t('portal.sessionRequired')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">{t('portal.title')}</h1>
      <p className="text-muted-foreground mb-6 text-sm">{t('portal.description')}</p>
      <DocumentsList clientId={clientId} taxYear={taxYear} showUpload compact={false} portalMode />
    </div>
  )
}
