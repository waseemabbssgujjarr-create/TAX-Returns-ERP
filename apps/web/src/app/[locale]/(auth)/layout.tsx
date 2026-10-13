import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/AuthCard'
import { BrandMark } from '@/components/auth/BrandMark'
import { LanguageSwitcher } from '@/components/auth/LanguageSwitcher'
import { VideoBackdrop } from '@/components/marketing/VideoBackdrop'
import { Link } from '@/i18n/navigation'

import '@/styles/auth.css'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('marketing.v2.auth')

  return (
    <div className="auth-shell mk-auth">
      <aside className="mk-auth-visual mk-dark">
        <VideoBackdrop sources={[{ src: '/videos/ledger-rain.mp4', poster: '/videos/ledger-rain.jpg' }]} />
        <div className="veil" aria-hidden="true" />
        <BrandMark />
        <div className="flex flex-col gap-5">
          <span className="mk-kicker w-fit">{t('kicker')}</span>
          <h2>{t('title')}</h2>
          <p>{t('body')}</p>
          <ul className="mk-chips">
            <li>{t('chip1')}</li>
            <li>{t('chip2')}</li>
            <li>{t('chip3')}</li>
          </ul>
        </div>
        <p className="text-xs text-white/60">{t('note')}</p>
      </aside>

      <div className="mk-auth-panel">
        <div className="mk-auth-top">
          <Link href="/" className="mk-auth-back">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            {t('back')}
          </Link>
          <LanguageSwitcher />
        </div>

        <main id="main-content" className="flex w-full max-w-md flex-col items-center gap-5" tabIndex={-1}>
          <div className="mk-mobile-brand">
            <BrandMark />
          </div>
          <AuthCard>{children}</AuthCard>
          <ul className="mk-trust">
            <li>{t('chip1')}</li>
            <li>{t('chip2')}</li>
            <li>{t('chip3')}</li>
          </ul>
        </main>
      </div>
    </div>
  )
}
