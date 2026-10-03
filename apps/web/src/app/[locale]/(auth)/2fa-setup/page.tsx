import { getTranslations } from 'next-intl/server'

import { TotpSetupWizard } from '@/components/auth/TotpSetupWizard'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.setup' })
  return { title: t('title') }
}

export default function TotpSetupPage() {
  return <TotpSetupWizard />
}
