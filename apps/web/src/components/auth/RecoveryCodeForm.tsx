'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { BackButton } from '@/components/auth/BackButton'
import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { useRequirePartialSession } from '@/components/auth/useRequirePartialSession'
import { useRouter } from '@/i18n/navigation'
import { getAuthMe, postTotpVerify } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/base'
import { normalizeRecoveryCodeInput } from '@/lib/recoveryCode'
import { useAuthStore } from '@/stores/authStore'

export function RecoveryCodeForm() {
  const t = useTranslations('auth.recover')
  const router = useRouter()
  const { accessToken, ready } = useRequirePartialSession()
  const setSessionFromMe = useAuthStore((s) => s.setSessionFromMe)

  const [code, setCode] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!ready || !accessToken) return null

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (code.length !== 10) return
    setIsSubmitting(true)
    setBanner(null)
    try {
      const { accessToken: fullToken } = await postTotpVerify({ recoveryCode: code }, accessToken)
      const me = await getAuthMe(fullToken)
      setSessionFromMe(fullToken, {
        user: me.user,
        firm: { name: me.firm.name, idleTimeoutMinutes: me.firm.idleTimeoutMinutes },
      })
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setBanner(t('invalidCode'))
      } else {
        setBanner(t('invalidCode'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <BackButton href="/2fa" label={t('backToTwoFa')} />
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
          <label htmlFor="recovery-code" className="text-sm font-medium">
            {t('codeLabel')}
          </label>
          <input
            id="recovery-code"
            type="text"
            maxLength={10}
            autoComplete="off"
            spellCheck={false}
            pattern="[A-F0-9]{10}"
            value={code}
            onChange={(e) => setCode(normalizeRecoveryCodeInput(e.target.value))}
            className="border-border bg-surface focus-visible:ring-primary min-h-12 w-full rounded-md border px-3 font-mono text-base tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            placeholder={t('codePlaceholder')}
            aria-invalid={!!banner}
          />
        </div>

        <SubmitButton isLoading={isSubmitting}>{t('submitButton')}</SubmitButton>
      </form>
    </>
  )
}
