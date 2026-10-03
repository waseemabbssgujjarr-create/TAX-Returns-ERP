import { getTranslations } from 'next-intl/server'

import { AdminUsersClient } from '@/components/admin/AdminUsersClient'
import { StaffPageHeader } from '@/components/staff/StaffPageHeader'
import { StaffPanel } from '@/components/staff/StaffPanel'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'admin.roles' })
  return { title: t('title') }
}

export default async function Page() {
  const t = await getTranslations('admin.roles')

  return (
    <div className="space-y-6">
      <StaffPageHeader title={t('title')} description={t('hint')} />
      <StaffPanel className="p-0 sm:p-[var(--spacing-card)]">
        <AdminUsersClient />
      </StaffPanel>
    </div>
  )
}
