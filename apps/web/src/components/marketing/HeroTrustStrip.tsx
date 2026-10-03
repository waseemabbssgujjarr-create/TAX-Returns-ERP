'use client'

import { ShieldCheck, Users, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

const ITEMS = [
  { key: 'firms' as const, icon: Users },
  { key: 'compliance' as const, icon: ShieldCheck },
  { key: 'speed' as const, icon: Zap },
]

export function HeroTrustStrip() {
  const t = useTranslations('marketing.hero.trust')

  return (
    <div
      className="border-border/80 bg-surface/80 relative z-10 mt-2 w-full backdrop-blur-sm sm:mt-0"
      aria-label={t('ariaLabel')}
    >
      <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-xl border border-border/80 sm:grid-cols-3">
        {ITEMS.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="bg-surface flex min-w-0 flex-col gap-1 px-4 py-4 sm:px-5 sm:py-5"
          >
            <div className="text-primary flex items-center gap-2">
              <span className="bg-primary-subtle flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-foreground text-lg font-semibold tabular-nums sm:text-xl">
                {t(`${key}.value`)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm">{t(`${key}.label`)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
