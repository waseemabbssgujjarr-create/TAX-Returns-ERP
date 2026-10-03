import { getTranslations } from 'next-intl/server'

import { ClientDetail } from '@/components/clients/ClientDetail'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'clients' })
  return { title: t('detail.title') }
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ClientDetail clientId={id} />
}
