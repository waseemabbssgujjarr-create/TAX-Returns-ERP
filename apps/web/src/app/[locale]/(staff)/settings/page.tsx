import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'admin.firmSettings' })
  return { title: t('title') }
}

/** Legacy /settings URL — firm controls live under the admin shell with sub-nav. */
export default async function SettingsRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/admin/firm-settings`)
}
