'use client'

import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'

import { BrandLogo } from '@/components/marketing/BrandLogo'
import { HeroProductVisual } from '@/components/marketing/HeroProductVisual'
import { HeroTrustStrip } from '@/components/marketing/HeroTrustStrip'
import { Link } from '@/i18n/navigation'

export function HeroSection() {

  const t = useTranslations('marketing.hero')



  return (

    <section className="relative isolate overflow-hidden pt-4 sm:pt-6">

      <div className="hero-ambient" aria-hidden="true" />

      <div className="hero-grid-glow pointer-events-none absolute inset-0" aria-hidden="true" />



      <div className="relative mx-auto min-w-0 max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:pb-20 lg:pt-14">

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12 xl:gap-16">

          <div className="flex min-w-0 flex-col items-start gap-5 text-start sm:gap-6">

            <BrandLogo size="lg" />



            <p className="text-primary text-xs font-bold uppercase tracking-[0.2em]">

              {t('brandProduct')}

            </p>



            <span className="border-border bg-surface/90 text-muted-foreground inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur-sm">

              {t('eyebrow')}

            </span>



            <h1 className="text-foreground marketing-hero-title text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12] xl:text-5xl">

              <span className="block">{t('headlineLine1')}</span>

              <span className="text-primary block">{t('headlineLine2')}</span>

            </h1>



            <p className="text-muted-foreground max-w-xl text-base leading-relaxed sm:text-lg">

              {t('supporting')}

            </p>



            <div className="flex w-full flex-wrap items-center gap-3 pt-1 sm:gap-4 sm:pt-2">

              <Button asChild size="lg" className="shadow-md">

                <Link href="/signup">{t('primaryCta')}</Link>

              </Button>

              <Button asChild size="lg" variant="secondary">

                <a href="#platform">{t('secondaryCta')}</a>

              </Button>

              <Button asChild variant="link" className="px-2">

                <Link href="/login">{t('signIn')}</Link>

              </Button>

            </div>

          </div>



          <div className="relative min-w-0 lg:justify-self-end">

            <HeroProductVisual />

          </div>

        </div>



        <div className="mt-10 sm:mt-12 lg:mt-14">

          <HeroTrustStrip />

        </div>

      </div>

    </section>

  )

}

