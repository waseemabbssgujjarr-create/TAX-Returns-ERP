'use client'

import { cn } from '@taxdesk/ui'
import { motion, useReducedMotion } from 'framer-motion'
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  FileText,
  LayoutDashboard,
  ScanLine,
  UploadCloud,
  Users,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

const PIPELINE_STEPS = [
  { key: 'upload' as const, icon: UploadCloud },
  { key: 'classify' as const, icon: ScanLine },
  { key: 'extract' as const, icon: FileSearch },
  { key: 'validate' as const, icon: ClipboardCheck },
  { key: 'review' as const, icon: CheckCircle2 },
]

const ACTIVE_PIPELINE_KEY = 'extract'

/**
 * Illustrative workspace composition — stacked cards (no overlap) for clear layout on all breakpoints.
 */
export function HeroProductVisual() {
  const t = useTranslations('marketing.productVisual')
  const tHero = useTranslations('marketing.hero')
  const reduce = useReducedMotion()

  const cardTransition = (delay: number) =>
    reduce ? { duration: 0 } : { duration: 0.45, delay, ease: [0, 0, 0.2, 1] as const }

  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 1, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: cardTransition(delay),
        }

  return (
    <div
      role="img"
      aria-label={tHero('visualLabel')}
      className="marketing-product-visual relative mx-auto w-full max-w-md sm:max-w-lg lg:max-w-none"
    >
      <div
        aria-hidden="true"
        className="bg-primary-subtle/50 pointer-events-none absolute -inset-6 rounded-[2.5rem] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="border-primary/15 pointer-events-none absolute -end-6 top-8 hidden size-24 rounded-2xl border bg-primary-subtle/30 sm:block"
      />
      <div
        aria-hidden="true"
        className="border-border pointer-events-none absolute -start-4 bottom-16 hidden size-16 rounded-xl border bg-surface shadow-lg sm:block"
      />

      <div className="border-border-strong bg-surface relative overflow-hidden rounded-2xl border shadow-2xl ring-1 ring-primary/10">
        <div className="border-border bg-surface-subtle/80 flex items-center gap-2 border-b px-4 py-2.5">
          <span className="bg-error/80 size-2.5 rounded-full" aria-hidden="true" />
          <span className="bg-warning/80 size-2.5 rounded-full" aria-hidden="true" />
          <span className="bg-success size-2.5 rounded-full" aria-hidden="true" />
          <span className="text-muted-foreground ms-2 truncate text-xs font-medium">
            {t('browserChrome')}
          </span>
        </div>

        <div aria-hidden="true" className="relative flex flex-col gap-4 p-4 sm:p-5">
        <motion.div
          {...enter(0)}
          className="border-border-strong bg-surface ring-primary/20 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-md ring-1"
        >
          <div className="text-muted-foreground flex items-center gap-2">
            <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium">{t('workspace')}</span>
          </div>
          <div className="flex min-w-[7rem] flex-col gap-1">
            <span className="text-muted-foreground text-end text-xs">{t('progress')}</span>
            <div className="bg-primary-subtle h-1.5 w-full overflow-hidden rounded-full">
              <div className="bg-primary h-full w-[68%] rounded-full" />
            </div>
          </div>
        </motion.div>

        <motion.div
          {...enter(0.08)}
          className="border-border-strong bg-surface ring-primary/25 rounded-xl border p-5 shadow-lg ring-1"
        >
          <div className="flex items-center gap-2">
            <span className="bg-primary-subtle text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
              <Users className="size-4" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                {t('portfolio')}
              </span>
              <span className="text-foreground truncate text-sm font-semibold">{t('clientName')}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="border-border bg-surface-subtle text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <FileText className="size-3.5" aria-hidden="true" />
              {t('documents')}
            </span>
            <span className="border-border bg-surface-subtle text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {t('taxYear')}
            </span>
          </div>

          <div className="border-border mt-4 flex items-center justify-between border-t pt-3">
            <span className="text-foreground text-xs font-medium">{t('reconciliation')}</span>
            <span className="bg-success-subtle text-success inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {t('reconciled')}
            </span>
          </div>
        </motion.div>

        <motion.div
          {...enter(0.16)}
          className="border-border-strong bg-surface ring-primary/20 rounded-xl border p-4 shadow-lg ring-1"
        >
          <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
            {t('pipeline')}
          </span>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {PIPELINE_STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = step.key === ACTIVE_PIPELINE_KEY
              const pulse =
                isActive && !reduce
                  ? {
                      animate: { scale: [1, 1.04, 1] },
                      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
                    }
                  : {}

              return (
                <div key={step.key} className="flex items-center gap-1">
                  <motion.span
                    {...pulse}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                      isActive
                        ? 'border-primary bg-primary-subtle text-primary'
                        : 'border-border bg-surface-subtle text-muted-foreground',
                    )}
                  >
                    <Icon className="size-3" aria-hidden="true" />
                    {t(step.key)}
                  </motion.span>
                  {index < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight
                      className="text-border-strong size-3 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
        </div>
      </div>
    </div>
  )
}
