'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@taxdesk/ui'
import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Link } from '@/i18n/navigation'

const FIRM_SIZE_VALUES = ['solo', 'small', 'medium', 'large'] as const

function buildSignupSchema(t: (key: string) => string) {
  return z.object({
    firmName: z.string().min(2, t('errors.firmName')),
    contactName: z.string().min(2, t('errors.contactName')),
    email: z.string().email(t('errors.email')),
    phone: z.string().min(7, t('errors.phone')).max(24, t('errors.phone')),
    city: z.string().min(2, t('errors.city')),
    firmSize: z.enum(FIRM_SIZE_VALUES, { required_error: t('errors.firmSize') }),
    notes: z.string().max(2000).optional(),
  })
}

type SignupFormValues = z.infer<ReturnType<typeof buildSignupSchema>>

export function SignupForm() {
  const t = useTranslations('marketing.signup')
  const [submitted, setSubmitted] = useState(false)

  const schema = useMemo(() => buildSignupSchema(t), [t])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firmName: '',
      contactName: '',
      email: '',
      phone: '',
      city: '',
      firmSize: 'small',
      notes: '',
    },
  })

  const onSubmit = () => {
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div
        className="border-border bg-surface flex flex-col items-center gap-4 rounded-xl border px-6 py-10 text-center shadow-sm"
        role="status"
      >
        <CheckCircle2 className="text-success size-10" aria-hidden="true" />
        <h2 className="text-foreground text-lg font-semibold">{t('success.title')}</h2>
        <p className="text-foreground/80 max-w-md text-sm leading-relaxed">{t('success.body')}</p>
      </div>
    )
  }

  return (
    <form
      className="border-border bg-surface flex flex-col gap-5 rounded-xl border p-6 shadow-sm sm:p-8"
      noValidate
      aria-label={t('formAria')}
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit(onSubmit)(e)
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('fields.firmName')} error={errors.firmName?.message} htmlFor="signup-firm">
          <input
            id="signup-firm"
            type="text"
            autoComplete="organization"
            className={inputClass(errors.firmName)}
            {...register('firmName')}
          />
        </Field>
        <Field
          label={t('fields.contactName')}
          error={errors.contactName?.message}
          htmlFor="signup-contact"
        >
          <input
            id="signup-contact"
            type="text"
            autoComplete="name"
            className={inputClass(errors.contactName)}
            {...register('contactName')}
          />
        </Field>
        <Field label={t('fields.email')} error={errors.email?.message} htmlFor="signup-email">
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            className={inputClass(errors.email)}
            {...register('email')}
          />
        </Field>
        <Field label={t('fields.phone')} error={errors.phone?.message} htmlFor="signup-phone">
          <input
            id="signup-phone"
            type="tel"
            autoComplete="tel"
            className={inputClass(errors.phone)}
            {...register('phone')}
          />
        </Field>
        <Field label={t('fields.city')} error={errors.city?.message} htmlFor="signup-city">
          <input
            id="signup-city"
            type="text"
            autoComplete="address-level2"
            className={inputClass(errors.city)}
            {...register('city')}
          />
        </Field>
        <Field label={t('fields.firmSize')} error={errors.firmSize?.message} htmlFor="signup-size">
          <select id="signup-size" className={inputClass(errors.firmSize)} {...register('firmSize')}>
            {FIRM_SIZE_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(`firmSizes.${value}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t('fields.notes')} error={errors.notes?.message} htmlFor="signup-notes">
        <textarea
          id="signup-notes"
          rows={4}
          className={inputClass(errors.notes)}
          {...register('notes')}
        />
      </Field>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {t('submit')}
        </Button>
        <p className="text-muted-foreground text-sm">
          {t('hasAccess')}{' '}
          <Link
            href="/login"
            className="text-primary focus-visible:ring-primary font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {t('signInLink')}
          </Link>
        </p>
      </div>
    </form>
  )
}

function inputClass(hasError: unknown) {
  return [
    'border-border bg-surface text-foreground focus-visible:ring-primary w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    hasError ? 'border-destructive' : '',
  ].join(' ')
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string
  error?: string | undefined
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-foreground text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
