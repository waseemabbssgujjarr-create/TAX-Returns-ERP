'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@taxdesk/ui'
import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { Link } from '@/i18n/navigation'
import { postRegister } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/base'

const FIRM_SIZE_VALUES = ['solo', 'small', 'medium', 'large'] as const

function buildSignupSchema(t: (key: string) => string) {
  return z
    .object({
      firmName: z.string().min(2, t('errors.firmName')),
      contactName: z.string().min(2, t('errors.contactName')),
      email: z.string().email(t('errors.email')),
      password: z.string().min(12, t('errors.password')),
      confirmPassword: z.string().min(12, t('errors.password')),
      phone: z.string().min(7, t('errors.phone')).max(24, t('errors.phone')),
      city: z.string().min(2, t('errors.city')),
      firmSize: z.enum(FIRM_SIZE_VALUES, { required_error: t('errors.firmSize') }),
      notes: z.string().max(2000).optional(),
      acceptTerms: z.boolean().refine((v) => v, t('errors.acceptTerms')),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: t('errors.passwordMatch'),
      path: ['confirmPassword'],
    })
}

type SignupFormValues = z.infer<ReturnType<typeof buildSignupSchema>>

type SignupFormProps = {
  variant?: 'marketing' | 'auth'
}

type SuccessState =
  | { kind: 'sent'; firmSlug: string }
  | { kind: 'delivery_failed'; firmSlug: string }

export function SignupForm({ variant = 'auth' }: SignupFormProps) {
  const t = useTranslations('marketing.signup')
  const isAuth = variant === 'auth'
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

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
      password: '',
      confirmPassword: '',
      phone: '',
      city: '',
      firmSize: 'small',
      notes: '',
      acceptTerms: false,
    },
  })

  const onSubmit = async (values: SignupFormValues) => {
    setBanner(null)
    try {
      const payload = {
        firmName: values.firmName,
        contactName: values.contactName,
        email: values.email,
        password: values.password,
        confirmPassword: values.confirmPassword,
        phone: values.phone,
        city: values.city,
        firmSize: values.firmSize,
        acceptTerms: true as const,
        ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
      }
      const result = await postRegister(payload)

      if (result.status === 'verification_pending' && result.emailDeliveryFailed) {
        setSuccess({ kind: 'delivery_failed', firmSlug: result.firmSlug })
        return
      }

      setSuccess({ kind: 'sent', firmSlug: result.firmSlug })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setBanner(t('errors.conflict'))
      } else if (err instanceof TypeError || (err instanceof ApiError && err.status >= 500)) {
        setBanner(t('errors.network'))
      } else {
        setBanner(t('errors.generic'))
      }
    }
  }

  if (success) {
    const isDeliveryFailed = success.kind === 'delivery_failed'
    return (
      <div
        className={
          isAuth
            ? 'flex flex-col items-center gap-4 py-4 text-center'
            : 'border-border bg-surface flex flex-col items-center gap-4 rounded-xl border px-6 py-10 text-center shadow-sm'
        }
        role="status"
      >
        <CheckCircle2
          className={isDeliveryFailed ? 'text-warning size-10' : 'text-success size-10'}
          aria-hidden="true"
        />
        <h2 className="text-foreground text-lg font-semibold">
          {isDeliveryFailed ? t('success.deliveryFailedTitle') : t('success.title')}
        </h2>
        <p className="text-foreground/80 max-w-md text-sm leading-relaxed">
          {isDeliveryFailed ? t('success.deliveryFailedBody') : t('success.body')}
        </p>
        <p className="text-muted-foreground text-xs">
          {t('success.firmSlugHint', { slug: success.firmSlug })}
        </p>
        <Link
          href={`/verify-email?firm=${encodeURIComponent(success.firmSlug)}`}
          className="text-primary text-sm font-semibold underline-offset-2 hover:underline"
        >
          {t('success.verifyLink')}
        </Link>
      </div>
    )
  }

  return (
    <form
      className={
        isAuth
          ? 'flex flex-col gap-4'
          : 'border-border bg-surface flex flex-col gap-5 rounded-xl border p-6 shadow-sm sm:p-8'
      }
      data-auth-wide={isAuth ? '' : undefined}
      noValidate
      aria-label={t('formAria')}
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit(onSubmit)(e)
      }}
    >
      {isAuth ? (
        <div>
          <h1 className="text-foreground text-lg font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('intro')}</p>
        </div>
      ) : null}

      {banner ? <ErrorBanner message={banner} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
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
        <Field label={t('fields.password')} error={errors.password?.message} htmlFor="signup-password">
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            className={inputClass(errors.password)}
            {...register('password')}
          />
        </Field>
        <Field
          label={t('fields.confirmPassword')}
          error={errors.confirmPassword?.message}
          htmlFor="signup-confirm-password"
        >
          <input
            id="signup-confirm-password"
            type="password"
            autoComplete="new-password"
            className={inputClass(errors.confirmPassword)}
            {...register('confirmPassword')}
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
          rows={3}
          className={inputClass(errors.notes)}
          {...register('notes')}
        />
      </Field>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" {...register('acceptTerms')} />
        <span>
          {t('fields.acceptTerms')}{' '}
          <Link href="/terms" className="text-primary font-medium underline-offset-2 hover:underline">
            {t('fields.termsLink')}
          </Link>
        </span>
      </label>
      {errors.acceptTerms ? (
        <p className="text-destructive text-xs" role="alert">
          {errors.acceptTerms.message}
        </p>
      ) : null}

      <div
        className={
          isAuth
            ? 'mt-1 flex flex-col gap-3'
            : 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'
        }
      >
        <Button type="submit" size="lg" disabled={isSubmitting} className={isAuth ? 'w-full' : undefined}>
          {t('submit')}
        </Button>
        <p className={`text-muted-foreground text-sm ${isAuth ? 'text-center' : ''}`}>
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
