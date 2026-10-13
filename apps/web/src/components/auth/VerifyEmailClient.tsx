'use client'

import { Button } from '@taxdesk/ui'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { Link } from '@/i18n/navigation'
import { postResendVerification, postVerifyEmail } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/base'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'verified'; firmSlug: string }
  | { kind: 'already_verified'; firmSlug: string }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'error'; message: string }

export function VerifyEmailClient() {
  const t = useTranslations('auth.verifyEmail')
  const searchParams = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [resendFirmSlug, setResendFirmSlug] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid' })
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const result = await postVerifyEmail({ token })
        if (cancelled) return
        switch (result.status) {
          case 'verified':
            setState({ kind: 'verified', firmSlug: result.firmSlug })
            setResendFirmSlug(result.firmSlug)
            break
          case 'already_verified':
            setState({ kind: 'already_verified', firmSlug: result.firmSlug })
            setResendFirmSlug(result.firmSlug)
            break
          case 'expired_token':
            setState({ kind: 'expired' })
            break
          case 'used_token':
            setState({ kind: 'used' })
            break
          default:
            setState({ kind: 'invalid' })
        }
      } catch {
        if (!cancelled) {
          setState({ kind: 'error', message: t('networkError') })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, t])

  const onResend = async () => {
    setResendError(null)
    setResendMessage(null)
    setResending(true)
    try {
      const result = await postResendVerification({
        firmSlug: resendFirmSlug.trim().toLowerCase(),
        email: resendEmail.trim(),
      })
      if (result.status === 'verification_pending' && result.emailDeliveryFailed) {
        setResendError(t('emailDeliveryFailed'))
      } else {
        setResendMessage(t('resent'))
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setResendError(t('resendCooldown'))
      } else {
        setResendError(t('resendFailed'))
      }
    } finally {
      setResending(false)
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <Loader2 className="text-primary size-8 animate-spin" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">{t('verifying')}</p>
      </div>
    )
  }

  if (state.kind === 'verified' || state.kind === 'already_verified') {
    const firmSlug = state.firmSlug
    return (
      <div className="flex flex-col gap-4 py-2" role="status">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="text-success size-10" aria-hidden="true" />
          <h1 className="text-foreground text-lg font-semibold">
            {state.kind === 'verified' ? t('successTitle') : t('alreadyTitle')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('successBody')}</p>
        </div>
        <Link
          href={`/login?firm=${encodeURIComponent(firmSlug)}`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-semibold"
        >
          {t('signIn')}
        </Link>
      </div>
    )
  }

  const problemTitle =
    state.kind === 'expired'
      ? t('expiredTitle')
      : state.kind === 'used'
        ? t('usedTitle')
        : state.kind === 'error'
          ? t('errorTitle')
          : t('invalidTitle')

  const problemBody =
    state.kind === 'expired'
      ? t('expiredBody')
      : state.kind === 'used'
        ? t('usedBody')
        : state.kind === 'error'
          ? state.message
          : t('invalidBody')

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="text-warning size-10" aria-hidden="true" />
        <h1 className="text-foreground text-lg font-semibold">{problemTitle}</h1>
        <p className="text-muted-foreground text-sm">{problemBody}</p>
      </div>

      <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-foreground text-sm font-medium">{t('resendHeading')}</p>
        {resendError ? <ErrorBanner message={resendError} /> : null}
        {resendMessage ? (
          <p className="text-success text-sm" role="status">
            {resendMessage}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('firmSlugLabel')}</span>
          <input
            className="border-border bg-surface min-h-11 rounded-md border px-3"
            value={resendFirmSlug}
            onChange={(e) => setResendFirmSlug(e.target.value)}
            autoComplete="organization"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('emailLabel')}</span>
          <input
            type="email"
            className="border-border bg-surface min-h-11 rounded-md border px-3"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <Button type="button" size="lg" className="w-full" disabled={resending} onClick={() => void onResend()}>
          {t('resendButton')}
        </Button>
      </div>

      <Link href="/login" className="text-primary text-center text-sm font-semibold underline-offset-2 hover:underline">
        {t('backToSignIn')}
      </Link>
    </div>
  )
}
