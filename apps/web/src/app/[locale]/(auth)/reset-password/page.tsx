import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'

import { ResetPasswordClient } from '@/components/auth/ResetPasswordClient'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.passwordReset' })
  return { title: t('confirmTitle') }
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordClient />
    </Suspense>
  )
}
