import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { LandingPage } from '@/components/marketing/LandingPage'

/** Presence flag cookie set once a staff session exists — see src/middleware.ts. */
const SESSION_COOKIE = 'td_session'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'marketing.meta' })

  const title = t('title')
  const description = t('description')

  return {
    // `absolute` bypasses the root layout's `%s | <appName>` title template —
    // the marketing title is already a complete, brand-first sentence.
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      locale: locale === 'ur' ? 'ur_PK' : 'en_PK',
      type: 'website',
      siteName: 'TaxDesk PK',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

/**
 * Public marketing landing page at `/{locale}`.
 * Signed-in staff (presence cookie set) are sent straight to the dashboard;
 * everyone else sees the TaxDesk PK landing page.
 */
export default async function MarketingHomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const cookieStore = await cookies()
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE)?.value)

  if (hasSession) {
    redirect(`/${locale}/dashboard`)
  }

  return <LandingPage />
}
