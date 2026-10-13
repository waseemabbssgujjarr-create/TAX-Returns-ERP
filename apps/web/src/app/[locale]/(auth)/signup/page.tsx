import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { SignupForm } from '@/components/marketing/SignupForm'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'marketing.signup' })
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function SignupPage() {
  return <SignupForm variant="auth" />
}
