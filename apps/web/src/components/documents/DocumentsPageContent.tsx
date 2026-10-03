'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { DocumentsHub } from '@/components/documents/DocumentsHub'
import { DocumentsList } from '@/components/documents/DocumentsList'

export function DocumentsPageContent() {
  const t = useTranslations('documents')
  const searchParams = useSearchParams()
  const clientId = searchParams.get('clientId')
  const taxYearParam = searchParams.get('taxYear')
  const taxYear = taxYearParam ? Number(taxYearParam) : new Date().getFullYear()

  if (!clientId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <DocumentsHub />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <DocumentsList clientId={clientId} taxYear={taxYear} showUpload compact={false} />
    </div>
  )
}
