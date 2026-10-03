import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { BrandLogo } from '@/components/marketing/BrandLogo'
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
  const t = await getTranslations('marketing.signup')
  const tPk = await getTranslations('marketing.pakistan')

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_1.15fr] lg:items-start lg:gap-14">
      <aside className="flex flex-col gap-6">
        <BrandLogo size="md" />
        <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="text-muted-foreground text-base leading-relaxed">{t('intro')}</p>
        <div className="relative mt-2 hidden min-h-[16rem] overflow-hidden rounded-2xl lg:block lg:min-h-[22rem]">
          <img
            src="/images/pakistan/lahore-badshahi.jpg"
            alt={tPk('places.lahore.alt')}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="marketing-photo-veil absolute inset-0" aria-hidden="true" />
          <p className="absolute inset-x-0 bottom-0 px-5 pb-5 text-sm font-semibold text-white">
            {tPk('places.lahore.caption')}
          </p>
        </div>
      </aside>
      <SignupForm />
    </div>
  )
}
