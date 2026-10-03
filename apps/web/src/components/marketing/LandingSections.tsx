'use client'

import { Button, cn } from '@taxdesk/ui'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Calculator,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Equal,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Globe,
  HandCoins,
  HelpCircle,
  Image as ImageIcon,
  Languages,
  ListChecks,
  Mail,
  Minus,
  MessageCircle,
  Plus,
  Receipt,
  ScanLine,
  ShieldCheck,
  StickyNote,
  Target,
  UploadCloud,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, type ElementType, type ReactNode } from 'react'

import { Reveal } from '@/components/marketing/Reveal'
import { Link } from '@/i18n/navigation'

// ── Shared presentational helpers ───────────────────────────────────────────

function SectionHeading({
  title,
  supporting,
  center,
}: {
  title: string
  supporting: string
  center?: boolean
}) {
  return (
    <Reveal className={cn('flex flex-col gap-3', center && 'items-center text-center')}>
      <h2 className="text-foreground marketing-section-title text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p
        className={cn(
          'text-muted-foreground marketing-section-support max-w-2xl text-base sm:text-lg',
          center && 'mx-auto',
        )}
      >
        {supporting}
      </p>
    </Reveal>
  )
}

function Chip({
  icon: Icon,
  children,
  tone = 'neutral',
}: {
  icon?: ElementType
  children: ReactNode
  tone?: 'neutral' | 'primary'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium',
        tone === 'primary'
          ? 'border-primary bg-primary-subtle text-primary'
          : 'border-border bg-surface text-muted-foreground',
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

// ── Problem → TaxDesk ────────────────────────────────────────────────────────

const FRAGMENT_KEYS = ['whatsapp', 'email', 'photos', 'spreadsheets', 'documents', 'notes'] as const

const FRAGMENT_ICONS: Record<(typeof FRAGMENT_KEYS)[number], ElementType> = {
  whatsapp: MessageCircle,
  email: Mail,
  photos: ImageIcon,
  spreadsheets: FileSpreadsheet,
  documents: FileText,
  notes: StickyNote,
}

export function ProblemSection() {
  const t = useTranslations('marketing.problem')

  return (
    <section className="bg-surface-subtle py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} center />

        <div className="mt-10 flex flex-col items-stretch gap-0 sm:items-center">
          <Reveal>
            <div
              className="border-border bg-surface mx-auto w-full max-w-3xl rounded-xl border px-4 py-5 shadow-sm sm:px-6"
              role="img"
              aria-label={t('flowAria')}
            >
              <p className="text-muted-foreground mb-4 text-center text-xs font-semibold uppercase tracking-wide">
                {t('sourcesLabel')}
              </p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="list">
                {FRAGMENT_KEYS.map((key) => {
                  const Icon = FRAGMENT_ICONS[key]
                  return (
                    <li key={key}>
                      <span className="border-border bg-surface-subtle text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <Icon className="text-primary size-4 shrink-0" aria-hidden="true" />
                        {t(`fragments.${key}`)}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <div className="mx-auto my-4 flex w-8 flex-col items-center gap-1" aria-hidden="true">
                <span className="bg-border-strong h-8 w-px" />
                <ArrowDown className="text-muted-foreground size-4" />
                <span className="bg-border-strong h-8 w-px" />
              </div>

              <p className="text-muted-foreground mb-3 text-center text-xs font-semibold uppercase tracking-wide">
                {t('into')}
              </p>
              <p className="border-primary bg-primary-subtle text-primary mx-auto w-fit rounded-lg border px-5 py-2.5 text-center text-base font-semibold">
                {t('product')}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ── Workspace / platform overview ───────────────────────────────────────────

const MODULE_KEYS = [
  'clients',
  'documents',
  'taxYears',
  'computation',
  'wealth',
  'withholding',
  'planning',
  'returns',
  'notices',
  'calendar',
  'billing',
  'portal',
  'analytics',
  'security',
] as const

const MODULE_ICONS: Record<(typeof MODULE_KEYS)[number], ElementType> = {
  clients: Users,
  documents: FileText,
  taxYears: CalendarDays,
  computation: Calculator,
  wealth: Wallet,
  withholding: Receipt,
  planning: Target,
  returns: FileCheck2,
  notices: Bell,
  calendar: CalendarClock,
  billing: CreditCard,
  portal: Globe,
  analytics: BarChart3,
  security: ShieldCheck,
}

export function WorkspaceSection() {
  const t = useTranslations('marketing.workspace')

  return (
    <section id="platform" className="bg-surface scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_KEYS.map((key, index) => {
            const Icon = MODULE_ICONS[key]
            return (
              <Reveal key={key} delay={(index % 3) * 0.05}>
                <button
                  type="button"
                  className="border-border bg-surface duration-base focus-visible:ring-primary group flex w-full flex-col gap-2 rounded-lg border p-4 text-start shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="bg-primary-subtle text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-foreground text-sm font-semibold">
                      {t(`modules.${key}.name`)}
                    </span>
                  </div>
                  <p className="text-muted-foreground duration-base max-h-0 overflow-hidden text-sm opacity-0 transition-all group-hover:max-h-16 group-hover:opacity-100 group-focus:max-h-16 group-focus:opacity-100">
                    {t(`modules.${key}.detail`)}
                  </p>
                </button>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Client CRM ───────────────────────────────────────────────────────────────

const CRM_COLUMN_KEYS = [
  'client',
  'year',
  'staff',
  'docs',
  'progress',
  'status',
  'deadline',
] as const

const CRM_DEMO_ROWS = [
  { nameKey: 'c1', statusKey: 'statusInProgress' },
  { nameKey: 'c2', statusKey: 'statusReview' },
  { nameKey: 'c3', statusKey: 'statusIntake' },
] as const

export function CrmSection() {
  const t = useTranslations('marketing.crm')

  return (
    <section id="features" className="bg-surface-subtle scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <Reveal delay={0.1} className="mt-8 flex flex-wrap gap-2">
          {CRM_COLUMN_KEYS.map((key) => (
            <Chip key={key}>{t(`columns.${key}`)}</Chip>
          ))}
        </Reveal>

        <div className="mt-6 flex flex-col gap-3">
          {CRM_DEMO_ROWS.map((row, index) => (
            <Reveal key={row.nameKey} delay={[0.15, 0.2, 0.25, 0.3][index] ?? 0.15}>
              <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Users className="text-muted-foreground size-4" aria-hidden="true" />
                  <span className="text-foreground text-sm font-medium">
                    {t(`demo.${row.nameKey}`)}
                  </span>
                </div>
                <span className="bg-primary-subtle text-primary inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                  {t(`demo.${row.statusKey}`)}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Documents + assisted extraction ─────────────────────────────────────────

const DOCUMENT_PIPELINE_KEYS = ['upload', 'classify', 'extract', 'validate', 'review'] as const
const DOCUMENT_PIPELINE_ICONS: Record<(typeof DOCUMENT_PIPELINE_KEYS)[number], ElementType> = {
  upload: UploadCloud,
  classify: ScanLine,
  extract: FileSearch,
  validate: ClipboardCheck,
  review: CheckCircle2,
}

const DOCUMENT_FIELD_KEYS = ['employer', 'gross', 'tax', 'benefits'] as const

export function DocumentsSection() {
  const t = useTranslations('marketing.documents')

  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-start">
          <Reveal>
            <ol className="flex flex-wrap items-center gap-2" role="list">
              {DOCUMENT_PIPELINE_KEYS.map((key, index) => (
                <li key={key} className="flex items-center gap-2">
                  <Chip icon={DOCUMENT_PIPELINE_ICONS[key]}>{t(key)}</Chip>
                  {index < DOCUMENT_PIPELINE_KEYS.length - 1 && (
                    <ChevronRight
                      className="text-border-strong size-4 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="border-border bg-surface rounded-xl border p-5 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <span className="text-foreground text-sm font-semibold">{t('sampleDoc')}</span>
                <span className="bg-warning-subtle text-warning inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium">
                  {t('reviewRequired')}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {DOCUMENT_FIELD_KEYS.map((key) => (
                  <div
                    key={key}
                    className="border-border bg-surface-subtle rounded-md border px-3 py-2"
                  >
                    <dt className="text-muted-foreground text-xs">{t(`fields.${key}`)}</dt>
                  </div>
                ))}
              </dl>
              <p className="text-muted-foreground mt-4 text-xs font-semibold uppercase tracking-wide">
                {t('structured')}
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2} className="border-primary mt-10 border-s-2 ps-4">
          <p className="text-foreground max-w-2xl text-base font-medium italic">{t('principle')}</p>
        </Reveal>
      </div>
    </section>
  )
}

// ── Tax-year workspace ───────────────────────────────────────────────────────

const TAX_YEAR_STEP_KEYS = [
  'income',
  'assets',
  'liabilities',
  'expenses',
  'withholding',
  'taxPayments',
  'reconciliation',
  'returnPrep',
] as const

const PROVENANCE_KEYS = ['editable', 'extracted', 'verified', 'calculated', 'needsReview'] as const

const PROVENANCE_STYLES: Record<(typeof PROVENANCE_KEYS)[number], string> = {
  editable: 'bg-surface-subtle text-muted-foreground',
  extracted: 'bg-info-subtle text-info',
  verified: 'bg-success-subtle text-success',
  calculated: 'bg-primary-subtle text-primary',
  needsReview: 'bg-warning-subtle text-warning',
}

export function TaxYearSection() {
  const t = useTranslations('marketing.taxYear')

  return (
    <section className="bg-surface-subtle py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <ul className="mt-10 grid gap-3 sm:grid-cols-2" role="list">
          {TAX_YEAR_STEP_KEYS.map((key, index) => {
            const provenanceKey = PROVENANCE_KEYS[index % PROVENANCE_KEYS.length] ?? 'editable'
            return (
              <li key={key}>
                <Reveal delay={(index % 4) * 0.05}>
                  <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-sm">
                    <span className="text-foreground text-sm font-medium">{t(`steps.${key}`)}</span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                        PROVENANCE_STYLES[provenanceKey],
                      )}
                    >
                      {t(`provenance.${provenanceKey}`)}
                    </span>
                  </div>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

// ── Computation ──────────────────────────────────────────────────────────────

const COMPUTATION_FLOW_KEYS = ['taxable', 'rules', 'slabs', 'credits', 'liability'] as const

export function ComputationSection() {
  const t = useTranslations('marketing.computation')

  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <Reveal delay={0.1}>
          <ol className="mt-10 flex flex-wrap items-center gap-2" role="list">
            {COMPUTATION_FLOW_KEYS.map((key, index) => (
              <li key={key} className="flex items-center gap-2">
                <Chip tone="primary">{t(`flow.${key}`)}</Chip>
                {index < COMPUTATION_FLOW_KEYS.length - 1 && (
                  <ArrowRight className="text-border-strong size-4 shrink-0" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal
          delay={0.2}
          className="text-muted-foreground mt-6 flex flex-wrap items-center gap-3 text-sm"
        >
          <span>{t('rulesVersion')}</span>
          <span aria-hidden="true">·</span>
          <span>{t('example')}</span>
          <span className="bg-success-subtle text-success inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {t('validated')}
          </span>
          <span className="bg-warning-subtle text-warning inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {t('reviewStatus')}
          </span>
        </Reveal>

        <Reveal
          delay={0.3}
          className="border-warning bg-warning-subtle mt-8 flex items-start gap-2.5 rounded-lg border px-4 py-3"
        >
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-warning text-sm">{t('disclaimer')}</p>
        </Reveal>
      </div>
    </section>
  )
}

// ── Wealth reconciliation ────────────────────────────────────────────────────

export function WealthSection() {
  const t = useTranslations('marketing.wealth')

  return (
    <section className="bg-surface-subtle py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Chip>{t('opening')}</Chip>
            <Plus className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <Chip>{t('income')}</Chip>
            <Minus className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <Chip>{t('expenses')}</Chip>
            <Minus className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <Chip>{t('tax')}</Chip>
            <Equal className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <Chip tone="primary">{t('closing')}</Chip>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Reveal delay={0.15}>
            <div className="border-success bg-success-subtle flex items-center gap-3 rounded-lg border p-4">
              <CheckCircle2 className="text-success size-5 shrink-0" aria-hidden="true" />
              <span className="text-success text-sm font-medium">{t('reconciled')}</span>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="border-warning bg-warning-subtle flex items-center gap-3 rounded-lg border p-4">
              <AlertTriangle className="text-warning size-5 shrink-0" aria-hidden="true" />
              <span className="text-warning text-sm font-medium">{t('difference')}</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ── Compliance & deadlines ───────────────────────────────────────────────────

const COMPLIANCE_FIELD_KEYS = ['deadline', 'notice', 'task', 'assignee', 'status'] as const

const COMPLIANCE_STATE_KEYS = ['reminder', 'completed', 'approaching'] as const
const COMPLIANCE_STATE_ICONS: Record<(typeof COMPLIANCE_STATE_KEYS)[number], ElementType> = {
  reminder: Bell,
  completed: CheckCircle2,
  approaching: AlertTriangle,
}

export function ComplianceSection() {
  const t = useTranslations('marketing.compliance')

  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <Reveal delay={0.1} className="mt-8 flex flex-wrap gap-2">
          {COMPLIANCE_FIELD_KEYS.map((key) => (
            <Chip key={key}>{t(key)}</Chip>
          ))}
        </Reveal>

        <Reveal delay={0.2} className="mt-6 flex flex-wrap gap-3">
          {COMPLIANCE_STATE_KEYS.map((key) => (
            <Chip key={key} icon={COMPLIANCE_STATE_ICONS[key]} tone="primary">
              {t(key)}
            </Chip>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// ── Billing ───────────────────────────────────────────────────────────────────

const BILLING_KEYS = ['invoice', 'advance', 'balance', 'payment', 'reminder'] as const
const BILLING_ICONS: Record<(typeof BILLING_KEYS)[number], ElementType> = {
  invoice: Receipt,
  advance: HandCoins,
  balance: Wallet,
  payment: CreditCard,
  reminder: Bell,
}

export function BillingSection() {
  const t = useTranslations('marketing.billing')

  return (
    <section className="bg-surface-subtle overflow-x-hidden py-16 sm:py-20">
      <div className="mx-auto min-w-0 max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <Reveal delay={0.1} className="mt-10 min-w-0 max-w-full">
          <ol
            className="border-border bg-surface flex w-full min-w-0 flex-col rounded-xl border shadow-sm sm:flex-row sm:items-stretch"
            role="list"
            aria-label={t('pipelineAria')}
          >
            {BILLING_KEYS.map((key, index) => {
              const Icon = BILLING_ICONS[key]
              return (
                <Fragment key={key}>
                  <li className="flex min-w-0 flex-1 flex-col items-center gap-2 px-4 py-4 text-center sm:px-3 sm:py-5 md:px-5">
                    <span className="bg-primary-subtle text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-foreground text-sm font-medium">{t(key)}</span>
                  </li>
                  {index < BILLING_KEYS.length - 1 ? (
                    <li
                      aria-hidden="true"
                      className="text-muted-foreground flex shrink-0 items-center justify-center py-0.5 sm:w-6 sm:py-0 md:w-8"
                    >
                      <ArrowDown className="size-4 sm:hidden" />
                      <ChevronRight className="text-border-strong hidden size-4 sm:block" />
                    </li>
                  ) : null}
                </Fragment>
              )
            })}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}

// ── Client portal ─────────────────────────────────────────────────────────────

const PORTAL_KEYS = [
  'requested',
  'progress',
  'questions',
  'approvals',
  'billing',
  'bilingual',
] as const
const PORTAL_ICONS: Record<(typeof PORTAL_KEYS)[number], ElementType> = {
  requested: UploadCloud,
  progress: ListChecks,
  questions: HelpCircle,
  approvals: BadgeCheck,
  billing: CreditCard,
  bilingual: Languages,
}

export function PortalSection() {
  const t = useTranslations('marketing.portal')

  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
          <Reveal>
            <ul className="flex flex-col gap-0" role="list">
              {PORTAL_KEYS.map((key) => {
                const Icon = PORTAL_ICONS[key]
                return (
                  <li
                    key={key}
                    className="border-border flex gap-4 border-b py-4 first:pt-0 last:border-b-0"
                  >
                    <span className="text-primary mt-0.5 shrink-0">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-sm font-semibold">{t(key)}</span>
                      <span className="text-muted-foreground text-sm">{t(`details.${key}`)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Reveal>

          <Reveal delay={0.12}>
            <div
              className="border-border-strong bg-surface-subtle mx-auto w-full max-w-sm rounded-[1.75rem] border p-3 shadow-lg ring-1 ring-black/5"
              aria-hidden="true"
            >
              <div className="bg-surface overflow-hidden rounded-[1.25rem] shadow-inner">
                <div className="border-border flex items-center justify-between border-b px-4 py-3">
                  <span className="text-foreground text-xs font-semibold">{t('mockTitle')}</span>
                  <span className="bg-success-subtle text-success rounded-full px-2 py-0.5 text-[10px] font-medium">
                    {t('mockStatus')}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-4">
                  {(['upload', 'question', 'approval'] as const).map((row) => (
                    <div
                      key={row}
                      className="border-border bg-surface-subtle flex items-center justify-between rounded-lg border px-3 py-2.5"
                    >
                      <span className="text-foreground text-xs font-medium">{t(`mock.${row}`)}</span>
                      <ChevronRight className="text-muted-foreground size-3.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ── Security ───────────────────────────────────────────────────────────────────

const SECURITY_ITEM_KEYS = [
  'auth',
  'totp',
  'tenancy',
  'rls',
  'encryption',
  'audit',
  'documents',
  'sessions',
] as const

export function SecuritySection() {
  const t = useTranslations('marketing.security')

  return (
    <section id="security" className="bg-surface-subtle scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-10">
          <Reveal className="relative min-h-[16rem] overflow-hidden rounded-xl lg:min-h-[22rem]">
            <img
              src="/images/pakistan/lahore-badshahi.jpg"
              alt={t('photoAlt')}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="marketing-photo-veil absolute inset-0" aria-hidden="true" />
            <p className="absolute inset-x-0 bottom-0 px-4 pb-4 text-sm font-medium leading-snug text-white sm:px-5 sm:pb-5">
              {t('photoCaption')}
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <ol className="flex flex-col gap-4" role="list">
              {SECURITY_ITEM_KEYS.map((key, index) => (
                <li key={key} className="flex gap-4">
                  <span
                    className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <p className="text-foreground pt-1 text-sm leading-relaxed">{t(`items.${key}`)}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ── Workflow / how it works ─────────────────────────────────────────────────

const WORKFLOW_STEP_KEYS = [
  'client',
  'documents',
  'extraction',
  'validation',
  'taxYear',
  'computation',
  'reconciliation',
  'review',
  'returnPrep',
  'approval',
  'billing',
  'compliance',
] as const

export function WorkflowSection() {
  const t = useTranslations('marketing.workflow')

  return (
    <section id="how-it-works" className="bg-surface scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} />

        <ol
          className="border-border relative mt-10 ms-3 max-w-2xl border-s-2 ps-8 sm:ms-4"
          role="list"
        >
          {WORKFLOW_STEP_KEYS.map((key, index) => (
            <li key={key} className="relative pb-8 last:pb-0">
              <span
                className="bg-primary border-surface absolute -start-[2.125rem] top-0.5 flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <Reveal delay={(index % 4) * 0.04}>
                <p className="text-foreground text-sm font-medium sm:text-base">{t(`steps.${key}`)}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ── Pakistan editorial imagery ───────────────────────────────────────────────

const PAKISTAN_PLACES = [
  { key: 'islamabad' as const, src: '/images/pakistan/islamabad.jpg', span: 'large' as const },
  { key: 'lahore' as const, src: '/images/pakistan/lahore-badshahi.jpg', span: 'small' as const },
  { key: 'karachi' as const, src: '/images/pakistan/karachi.jpg', span: 'small' as const },
]

export function PakistanPlacesSection() {
  const t = useTranslations('marketing.pakistan')

  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} center />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:grid-rows-2 lg:gap-5">
          {PAKISTAN_PLACES.map((place, index) => (
            <Reveal
              key={place.key}
              delay={index === 0 ? 0 : index === 1 ? 0.1 : 0.15}
              className={
                place.span === 'large'
                  ? 'relative min-h-[14rem] overflow-hidden rounded-xl sm:col-span-1 sm:row-span-2 sm:min-h-[20rem]'
                  : 'relative min-h-[10rem] overflow-hidden rounded-xl sm:min-h-[9.5rem]'
              }
            >
              <img
                src={place.src}
                alt={t(`places.${place.key}.alt`)}
                className="absolute inset-0 size-full object-cover"
              />
              <div className="marketing-photo-veil absolute inset-0" aria-hidden="true" />
              <p className="absolute inset-x-0 bottom-0 px-4 pb-4 text-sm font-semibold text-white sm:px-5 sm:pb-5">
                {t(`places.${place.key}.caption`)}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Proof / honesty statement ────────────────────────────────────────────────

export function ProofSection() {
  const t = useTranslations('marketing.proof')

  return (
    <section className="bg-surface-subtle py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <SectionHeading title={t('title')} supporting={t('supporting')} center />
      </div>
    </section>
  )
}

// ── Final CTA ────────────────────────────────────────────────────────────────

export function FinalCtaSection() {
  const t = useTranslations('marketing.finalCta')

  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="border-border-strong bg-surface ring-primary/15 flex flex-col items-center gap-6 rounded-2xl border px-6 py-12 text-center shadow-lg ring-1 sm:px-12">
          <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h2>
          <p className="text-foreground/80 max-w-xl text-base sm:text-lg">{t('supporting')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/signup">{t('getStarted')}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/login">{t('signIn')}</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
