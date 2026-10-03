'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { BackButton } from '@/components/auth/BackButton'
import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { OtpInput } from '@/components/auth/OtpInput'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { useRequirePartialSession } from '@/components/auth/useRequirePartialSession'
import { Link, useRouter } from '@/i18n/navigation'
import { getAuthMe, postTotpVerify } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/base'
import { useAuthStore } from '@/stores/authStore'

export function TotpVerifyForm() {
  const t = useTranslations('auth.twoFa')
  const router = useRouter()
  const { accessToken, ready } = useRequirePartialSession()
  const setSessionFromMe = useAuthStore((s) => s.setSessionFromMe)
  const clearToken = useAuthStore((s) => s.clearToken)

  const [code, setCode] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [failCount, setFailCount] = useState(0)
  const [clearSignal, setClearSignal] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!ready || !accessToken) {
    return null
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (code.length !== 6) return
    setIsSubmitting(true)
    setBanner(null)
    try {
      const { accessToken: fullToken } = await postTotpVerify({ code }, accessToken)
      const me = await getAuthMe(fullToken)
      setSessionFromMe(fullToken, {
        user: me.user,
        firm: { name: me.firm.name, idleTimeoutMinutes: me.firm.idleTimeoutMinutes },
      })
      router.push('/dashboard')
    } catch (err) {
      const nextFails = failCount + 1
      setFailCount(nextFails)
      setCode('')
      setClearSignal((n) => n + 1)
      if (err instanceof ApiError && err.status === 401) {
        const remaining = Math.max(0, 5 - nextFails)
        setBanner(remaining > 0 ? t('invalidCode', { count: remaining }) : t('invalidCodeGeneric'))
        if (nextFails >= 5) {
          clearToken()
          router.push('/login')
        }
      } else {
        setBanner(t('invalidCodeGeneric'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <BackButton href="/login" label={t('backToLogin')} />
      <form
        aria-label={t('formLabel')}
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-4"
      >
        <div>
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('instruction')}</p>
        </div>

        {banner ? <ErrorBanner message={banner} /> : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="totp-code" className="text-sm font-medium">
            {t('codeLabel')}
          </label>
          <OtpInput
            id="totp-code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            hasError={!!banner}
            onClearSignal={clearSignal}
          />
        </div>

        <SubmitButton isLoading={isSubmitting}>{t('submitButton')}</SubmitButton>

        <Link href="/recover" className="text-center text-sm font-medium">
          {t('recoveryLink')}
        </Link>
      </form>
    </>
  )
}
