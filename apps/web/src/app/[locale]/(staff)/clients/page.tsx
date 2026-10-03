import { getTranslations } from 'next-intl/server'

import { ClientsList } from '@/components/clients/ClientsList'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'clients' })
  return { title: t('title') }
}

export default function ClientsPage() {
  return <ClientsList />
}
