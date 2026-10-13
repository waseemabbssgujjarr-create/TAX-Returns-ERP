'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Link, useRouter } from '@/i18n/navigation'
import { postPasswordResetConfirm } from '@/lib/api/auth'

const Schema = z
  .object({
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof Schema>

type ViewState =
  | { kind: 'form' }
  | { kind: 'success'; firmSlug: string }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'used' }

export function ResetPasswordClient() {
  const t = useTranslations('auth.passwordReset')
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')?.trim() ?? ''
  const [view, setView] = useState<ViewState>({ kind: 'form' })
  const [banner, setBanner] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (!token) {
      setView({ kind: 'invalid' })
    }
  }, [token])

  const submitForm = async (values: FormValues) => {
    if (!token) return
    setBanner(null)
    try {
      const result = await postPasswordResetConfirm({
        token,
        password: values.password,
        confirmPassword: values.confirmPassword,
      })
      switch (result.status) {
        case 'password_updated':
          setView({ kind: 'success', firmSlug: result.firmSlug })
          break
        case 'expired_token':
          setView({ kind: 'expired' })
          break
        case 'used_token':
          setView({ kind: 'used' })
          break
        default:
          setView({ kind: 'invalid' })
      }
    } catch {
      setBanner(t('networkError'))
    }
  }

  if (view.kind === 'invalid') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold">{t('invalidTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('invalidBody')}</p>
        <Link href="/password-reset" className="text-sm font-medium">
          {t('title')}
        </Link>
      </div>
    )
  }

  if (view.kind === 'expired') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold">{t('expiredTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('expiredBody')}</p>
        <Link href="/password-reset" className="text-sm font-medium">
          {t('title')}
        </Link>
      </div>
    )
  }

  if (view.kind === 'used') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold">{t('usedTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('usedBody')}</p>
        <Link href="/password-reset" className="text-sm font-medium">
          {t('title')}
        </Link>
      </div>
    )
  }

  if (view.kind === 'success') {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="text-primary mx-auto h-10 w-10" aria-hidden />
        <h1 className="text-lg font-semibold">{t('successTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('successBody')}</p>
        <button
          type="button"
          className="text-sm font-medium underline"
          onClick={() => router.push(`/login?firm=${encodeURIComponent(view.firmSlug)}`)}
        >
          {t('backToSignIn')}
        </button>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" aria-label={t('confirmTitle')} />
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit(submitForm)(e)
      }}
      noValidate
    >
      <div>
        <h1 className="text-lg font-semibold">{t('confirmTitle')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('confirmSubtitle')}</p>
      </div>
      {banner ? <ErrorBanner message={banner} /> : null}
      <div>
        <label className="text-sm font-medium" htmlFor="password">
          {t('passwordLabel')}
        </label>
        <input
          id="password"
          type="password"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          autoComplete="new-password"
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-destructive mt-1 text-xs">{errors.password.message}</p>
        ) : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="confirmPassword">
          {t('confirmPasswordLabel')}
        </label>
        <input
          id="confirmPassword"
          type="password"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p className="text-destructive mt-1 text-xs">{errors.confirmPassword.message}</p>
        ) : null}
      </div>
      <SubmitButton isLoading={isSubmitting}>{t('confirmSubmit')}</SubmitButton>
    </form>
  )
}
