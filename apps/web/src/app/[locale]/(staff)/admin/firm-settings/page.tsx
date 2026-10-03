import { getTranslations } from 'next-intl/server'

import { AdminFirmSettingsClient } from '@/components/admin/AdminFirmSettingsClient'
import { StaffPageHeader } from '@/components/staff/StaffPageHeader'
import { StaffPanel } from '@/components/staff/StaffPanel'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'admin.firmSettings' })
  return { title: t('title') }
}

export default async function Page() {
  const t = await getTranslations('admin.firmSettings')

  return (
    <div className="space-y-6">
      <StaffPageHeader title={t('title')} />
      <StaffPanel>
        <AdminFirmSettingsClient />
      </StaffPanel>
    </div>
  )
}
