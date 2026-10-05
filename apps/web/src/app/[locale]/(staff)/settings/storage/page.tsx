import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { StorageSettingsClient } from '@/components/settings/StorageSettingsClient'
import { StaffPageHeader } from '@/components/staff/StaffPageHeader'
import { StaffPanel } from '@/components/staff/StaffPanel'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'settings.storage' })
  return { title: t('title') }
}

export default async function SettingsStoragePage() {
  const t = await getTranslations('settings.storage')

  return (
    <div className="space-y-6">
      <StaffPageHeader title={t('title')} description={t('pageSubtitle')} />
      <StaffPanel>
        <Suspense fallback={<div className="bg-surface-hover h-32 animate-pulse rounded-lg" />}>
          <StorageSettingsClient />
        </Suspense>
      </StaffPanel>
    </div>
  )
}
