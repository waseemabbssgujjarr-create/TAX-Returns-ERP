import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { PortalLoginForm } from '@/components/auth/PortalLoginForm'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.portal' })
  return { title: t('title') }
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <PortalLoginForm />
    </Suspense>
  )
}
