import { getTranslations } from 'next-intl/server'

import { AdminAuditClient } from '@/components/admin/AdminAuditClient'
import { StaffPageHeader } from '@/components/staff/StaffPageHeader'
import { StaffPanel } from '@/components/staff/StaffPanel'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'admin.audit' })
  return { title: t('title') }
}

export default async function Page() {
  const t = await getTranslations('admin.audit')

  return (
    <div className="space-y-6">
      <StaffPageHeader title={t('title')} />
      <StaffPanel>
        <AdminAuditClient />
      </StaffPanel>
    </div>
  )
}
