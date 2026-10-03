import { getTranslations } from 'next-intl/server'

import { DashboardPageClient } from '@/components/dashboard/DashboardPageClient'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  return { title: t('title') }
}

export default function DashboardPage() {
  return <DashboardPageClient />
}
