import { getTranslations } from 'next-intl/server'

import { PasswordResetRequestForm } from '@/components/auth/PasswordResetRequestForm'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.passwordReset' })
  return { title: t('title') }
}

export default function PasswordResetPage() {
  return <PasswordResetRequestForm />
}
