'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { LanguageSwitcher } from '@/components/auth/LanguageSwitcher'
import { OtpInput } from '@/components/auth/OtpInput'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { SuccessBanner } from '@/components/auth/SuccessBanner'
import { useRouter } from '@/i18n/navigation'
import { postOtpSend, postOtpVerify } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/base'
import { useAuthStore } from '@/stores/authStore'

const RESEND_SECONDS = 60

/** @internal exported for unit tests */
export function isResendEnabled(secondsRemaining: number): boolean {
  return secondsRemaining <= 0
}
const FIRM_SLUG_PATTERN = /^[a-z0-9-]{2,60}$/

type Phase = 'contact' | 'otp'

export function PortalLoginForm() {
  const t = useTranslations('auth.portal')
  const router = useRouter()
  const searchParams = useSearchParams()
  const setToken = useAuthStore((s) => s.setToken)

  const firmSlugParam = (searchParams.get('firm') ?? searchParams.get('firmSlug') ?? '')
    .toLowerCase()
    .trim()

  const [phase, setPhase] = useState<Phase>('contact')
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [otpFailCount, setOtpFailCount] = useState(0)
  const [clearSignal, setClearSignal] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)

  const firmValid = FIRM_SLUG_PATTERN.test(firmSlugParam)

  useEffect(() => {
    if (phase !== 'otp' || resendSeconds <= 0) return
    const timer = window.setInterval(() => {
      setResendSeconds((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase, resendSeconds])

  if (!firmValid) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-8">
        <LanguageSwitcher className="self-start" />
        <ErrorBanner message={t('missingFirm')} />
      </div>
    )
  }

  const sendOtp = async () => {
    setIsSubmitting(true)
    setBanner(null)
    try {
      await postOtpSend({ firmSlug: firmSlugParam, contact: contact.trim(), channel: 'email' })
      setPhase('otp')
      setResendSeconds(RESEND_SECONDS)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setPhase('otp')
        setResendSeconds(RESEND_SECONDS)
      } else {
        setBanner(t('networkError'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const verifyOtp = async () => {
    if (code.length !== 6) return
    setIsSubmitting(true)
    setBanner(null)
    try {
      const { accessToken } = await postOtpVerify({
        firmSlug: firmSlugParam,
        contact: contact.trim(),
        code,
      })
      setToken(accessToken)
      router.push('/portal/home')
    } catch {
      const next = otpFailCount + 1
      setOtpFailCount(next)
      setCode('')
      setClearSignal((n) => n + 1)
      const remaining = Math.max(0, 3 - next)
      setBanner(remaining > 0 ? t('invalidOtp', { count: remaining }) : t('invalidOtpGeneric'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-8">
      <LanguageSwitcher className="self-start" />

      <div className="bg-surface rounded-lg px-6 py-8 shadow-md">
        <h1 className="text-lg font-semibold">{t('title')}</h1>

        {phase === 'contact' ? (
          <form
            aria-label={t('formLabelContact')}
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void sendOtp()
            }}
          >
            {banner ? <ErrorBanner message={banner} /> : null}
            <div className="flex flex-col gap-1">
              <label htmlFor="portal-contact" className="text-sm font-medium">
                {t('contactLabel')}
              </label>
              <input
                id="portal-contact"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="border-border bg-surface min-h-12 w-full rounded-md border px-3 text-base"
                placeholder={t('contactPlaceholder')}
                required
              />
            </div>
            <SubmitButton isLoading={isSubmitting}>{t('sendOtp')}</SubmitButton>
          </form>
        ) : (
          <form
            aria-label={t('formLabelOtp')}
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void verifyOtp()
            }}
          >
            <SuccessBanner message={t('otpSent')} />
            {banner ? <ErrorBanner message={banner} /> : null}
            <OtpInput
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              hasError={!!banner}
              onClearSignal={clearSignal}
            />
            <p className="text-muted-foreground text-center text-sm">
              {resendSeconds > 0 ? t('resendIn', { seconds: resendSeconds }) : null}
            </p>
            <button
              type="button"
              className="text-primary text-center text-sm font-medium underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-40"
              aria-disabled={!isResendEnabled(resendSeconds)}
              disabled={!isResendEnabled(resendSeconds)}
              onClick={() => void sendOtp()}
            >
              {t('resend')}
            </button>
            <SubmitButton isLoading={isSubmitting}>{t('verifyOtp')}</SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}
