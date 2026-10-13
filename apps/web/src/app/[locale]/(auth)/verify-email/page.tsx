import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'

import { VerifyEmailClient } from '@/components/auth/VerifyEmailClient'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.verifyEmail' })
  return { title: t('pageTitle') }
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <p className="text-muted-foreground py-6 text-center text-sm" role="status">
          …
        </p>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  )
}
