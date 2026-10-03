import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.passwordReset' })
  return { title: t('title') }
}

export default async function PasswordResetStubPage() {
  const t = await getTranslations('auth.passwordReset')
  return (
    <div className="text-center">
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground mt-4 text-sm">{t('comingSoon')}</p>
    </div>
  )
}
