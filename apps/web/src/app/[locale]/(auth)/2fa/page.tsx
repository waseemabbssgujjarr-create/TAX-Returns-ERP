import { getTranslations } from 'next-intl/server'

import { TotpVerifyForm } from '@/components/auth/TotpVerifyForm'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.twoFa' })
  return { title: t('title') }
}

export default function TotpVerifyPage() {
  return <TotpVerifyForm />
}
