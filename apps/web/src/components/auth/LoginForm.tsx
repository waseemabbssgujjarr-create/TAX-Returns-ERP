'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Link, useRouter } from '@/i18n/navigation'
import { postLogin } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/base'
import { useAuthStore } from '@/stores/authStore'

const LoginSchema = z.object({
  firmSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  password: z.string().min(1),
})

type LoginFormValues = z.infer<typeof LoginSchema>

export function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const setToken = useAuthStore((s) => s.setToken)
  const [showPassword, setShowPassword] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { firmSlug: '', email: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setBanner(null)
    try {
      const result = await postLogin(values)
      setToken(result.accessToken)
      if ('requiresTotpSetup' in result && result.requiresTotpSetup) {
        router.push('/2fa-setup')
      } else {
        router.push('/2fa')
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setBanner(t('invalidCredentials'))
      } else if (
        err instanceof TypeError ||
        (err instanceof ApiError && (err.status === 502 || err.status === 503 || err.status === 504))
      ) {
        setBanner(t('apiUnavailable'))
      } else {
        setBanner(t('networkError'))
      }
    }
  }

  return (
    <form
      aria-label={t('formLabel')}
      method="post"
      action="#"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit(onSubmit)(e)
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <h1 className="text-foreground text-lg font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('tagline')}</p>
      </div>

      {banner ? <ErrorBanner message={banner} /> : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="firmSlug" className="text-sm font-medium">
          {t('firmSlugLabel')}
        </label>
        <input
          id="firmSlug"
          autoComplete="organization"
          inputMode="text"
          className="border-border bg-surface focus-visible:ring-primary min-h-12 w-full rounded-md border px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-invalid={!!errors.firmSlug}
          aria-describedby={errors.firmSlug ? 'firmSlug-error' : undefined}
          {...register('firmSlug', {
            onBlur: () => {
              const v = getValues('firmSlug')
              setValue('firmSlug', v.toLowerCase().trim(), { shouldValidate: true })
            },
          })}
          placeholder={t('firmSlugPlaceholder')}
        />
        {errors.firmSlug ? (
          <p id="firmSlug-error" className="text-error text-sm" role="alert">
            {errors.firmSlug.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {t('emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="border-border bg-surface focus-visible:ring-primary min-h-12 w-full rounded-md border px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-invalid={!!errors.email}
          {...register('email')}
          placeholder={t('emailPlaceholder')}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t('passwordLabel')}
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="border-border bg-surface focus-visible:ring-primary min-h-12 w-full rounded-md border px-3 pe-12 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            {...register('password')}
            placeholder={t('passwordPlaceholder')}
          />
          <button
            type="button"
            className="text-muted-foreground absolute inset-y-0 end-0 flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      <Link href="/password-reset" className="text-sm font-medium">
        {t('forgotPassword')}
      </Link>

      <SubmitButton
        isLoading={isSubmitting}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+1rem)] w-full sm:static"
      >
        {t('submitButton')}
      </SubmitButton>

      <p className="text-muted-foreground text-center text-sm">
        {t('noAccess')}{' '}
        <Link
          href="/signup"
          className="text-primary focus-visible:ring-primary font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('registerLink')}
        </Link>
      </p>
    </form>
  )
}
