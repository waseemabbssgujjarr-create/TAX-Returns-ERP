'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Link } from '@/i18n/navigation'
import { postPasswordResetRequest } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/base'

const Schema = z.object({
  firmSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
})

type FormValues = z.infer<typeof Schema>

export function PasswordResetRequestForm() {
  const t = useTranslations('auth.passwordReset')
  const [banner, setBanner] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { firmSlug: '', email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      const result = await postPasswordResetRequest({
        firmSlug: values.firmSlug.toLowerCase().trim(),
        email: values.email.trim(),
      })
      if (result.status === 'reset_email_pending' && result.emailDeliveryFailed) {
        setBanner(t('deliveryFailed'))
        return
      }
      setSent(true)
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setBanner(t('cooldown'))
        return
      }
      setBanner(t('networkError'))
    }
  })

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold">{t('sentTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('sentBody')}</p>
        <Link href="/login" className="text-sm font-medium">
          {t('backToSignIn')}
        </Link>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
      </div>
      {banner ? <ErrorBanner message={banner} /> : null}
      <div>
        <label className="text-sm font-medium" htmlFor="firmSlug">
          {t('firmSlugLabel')}
        </label>
        <input
          id="firmSlug"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          autoComplete="organization"
          {...register('firmSlug')}
        />
        {errors.firmSlug ? (
          <p className="text-destructive mt-1 text-xs">{errors.firmSlug.message}</p>
        ) : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="email">
          {t('emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          autoComplete="email"
          {...register('email')}
        />
        {errors.email ? (
          <p className="text-destructive mt-1 text-xs">{errors.email.message}</p>
        ) : null}
      </div>
      <SubmitButton isLoading={isSubmitting}>{t('submitButton')}</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login">{t('backToSignIn')}</Link>
      </p>
    </form>
  )
}
