import { getTranslations } from 'next-intl/server'

import { AdminIntegrationsClient } from '@/components/admin/AdminIntegrationsClient'
import { StaffPageHeader } from '@/components/staff/StaffPageHeader'
import { StaffPanel } from '@/components/staff/StaffPanel'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'admin.integrations' })
  return { title: t('title') }
}

export default async function Page() {
  const t = await getTranslations('admin.integrations')

  return (
    <div className="space-y-6">
      <StaffPageHeader title={t('title')} />
      <StaffPanel>
        <AdminIntegrationsClient />
      </StaffPanel>
    </div>
  )
}
