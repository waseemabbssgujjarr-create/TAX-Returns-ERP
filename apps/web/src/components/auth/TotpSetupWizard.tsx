'use client'

import { Button } from '@taxdesk/ui'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ErrorBanner } from '@/components/auth/ErrorBanner'
import { OtpInput } from '@/components/auth/OtpInput'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { useRequirePartialSession } from '@/components/auth/useRequirePartialSession'
import { useRouter } from '@/i18n/navigation'
import {
  getAuthMe,
  postTotpSetupComplete,
  postTotpSetupConfirm,
  postTotpSetupInitiate,
} from '@/lib/api/auth'
import { ApiError } from '@/lib/api/base'
import { useAuthStore } from '@/stores/authStore'

type Step = 1 | 2 | 3

export function TotpSetupWizard() {
  const t = useTranslations('auth.setup')
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const { accessToken, ready } = useRequirePartialSession()
  const setSessionFromMe = useAuthStore((s) => s.setSessionFromMe)
  const clearToken = useAuthStore((s) => s.clearToken)

  const [step, setStep] = useState<Step>(1)
  const [qr, setQr] = useState<{ qrCodeDataUrl: string; secretDisplayText: string } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [failCount, setFailCount] = useState(0)
  const [clearSignal, setClearSignal] = useState(0)
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadingInit, setLoadingInit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  useEffect(() => {
    return () => {
      setRecoveryCodes([])
    }
  }, [])

  const loadQr = useCallback(async () => {
    if (!accessToken || qr) return
    setLoadingInit(true)
    try {
      const data = await postTotpSetupInitiate(accessToken)
      setQr({ qrCodeDataUrl: data.qrCodeDataUrl, secretDisplayText: data.secretDisplayText })
    } catch {
      setBanner(t('invalidCodeGeneric'))
    } finally {
      setLoadingInit(false)
    }
  }, [accessToken, qr, t])

  useEffect(() => {
    if (ready && accessToken && step === 1) {
      void loadQr()
    }
  }, [accessToken, loadQr, ready, step])

  if (!ready || !accessToken) return null

  const stepLabels = [t('stepScan'), t('stepVerify'), t('stepRecovery')]

  const confirmCode = async () => {
    if (code.length !== 6) return
    setIsSubmitting(true)
    setBanner(null)
    try {
      const { recoveryCodes: codes } = await postTotpSetupConfirm(code, accessToken)
      setRecoveryCodes(codes)
      setStep(3)
      setCode('')
    } catch (err) {
      const next = failCount + 1
      setFailCount(next)
      setCode('')
      setClearSignal((n) => n + 1)
      if (err instanceof ApiError && err.status === 401) {
        const remaining = Math.max(0, 5 - next)
        setBanner(remaining > 0 ? t('invalidCode', { count: remaining }) : t('invalidCodeGeneric'))
        if (next >= 5) {
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

  const finishSetup = async () => {
    setIsSubmitting(true)
    try {
      const { accessToken: fullToken } = await postTotpSetupComplete(accessToken)
      setRecoveryCodes([])
      const me = await getAuthMe(fullToken)
      setSessionFromMe(fullToken, {
        user: me.user,
        firm: { name: me.firm.name, idleTimeoutMinutes: me.firm.idleTimeoutMinutes },
      })
      router.push('/dashboard')
    } catch {
      setBanner(t('invalidCodeGeneric'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const downloadCodes = () => {
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'taxdesk-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyAll = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t('title')}>
        <ol className="flex justify-between gap-2 text-xs font-medium">
          {stepLabels.map((label, index) => {
            const stepNum = (index + 1) as Step
            const isActive = step === stepNum
            const isDone = step > stepNum
            return (
              <li
                key={label}
                aria-current={isActive ? 'step' : undefined}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full border ${
                    isDone
                      ? 'border-primary bg-primary text-white'
                      : isActive
                        ? 'border-primary'
                        : 'border-border'
                  }`}
                >
                  {isDone ? <Check className="size-4" aria-hidden="true" /> : stepNum}
                </span>
                <span>{label}</span>
              </li>
            )
          })}
        </ol>
      </nav>

      <motion.div
        key={step}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
      >
        <h1 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          {t('title')}
        </h1>

        {banner ? <ErrorBanner message={banner} /> : null}

        {step === 1 ? (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">{t('scanInstruction')}</p>
            {qr ? (
              <img
                src={qr.qrCodeDataUrl}
                alt={t('qrAlt')}
                width={200}
                height={200}
                className="border-border mx-auto rounded-md border"
              />
            ) : (
              <div className="skeleton mx-auto size-[200px] rounded-md" aria-busy={loadingInit} />
            )}
            <details className="border-border rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">{t('manualEntry')}</summary>
              <p className="text-muted-foreground mt-2 text-xs">{t('manualEntryHint')}</p>
              <p className="mt-2 select-all font-mono text-sm">{qr?.secretDisplayText}</p>
            </details>
            <Button type="button" variant="primary" className="w-full" onClick={() => setStep(2)}>
              {t('continue')}
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void confirmCode()
            }}
          >
            <p className="text-muted-foreground text-sm">{t('verifyInstruction')}</p>
            <OtpInput
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              hasError={!!banner}
              onClearSignal={clearSignal}
            />
            <SubmitButton isLoading={isSubmitting}>{t('confirm')}</SubmitButton>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-warning text-sm font-medium">{t('recoveryWarning')}</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
              {recoveryCodes.map((c) => (
                <code key={c} className="border-border select-all rounded border px-2 py-1">
                  {c}
                </code>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={downloadCodes}>
                {t('downloadCodes')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void copyAll()}>
                {copied ? t('copied') : t('copyAll')}
              </Button>
            </div>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                aria-required="true"
                className="mt-1 size-4"
              />
              {t('acknowledgeLabel')}
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (acknowledged) void finishSetup()
              }}
            >
              <SubmitButton isLoading={isSubmitting} disabled={!acknowledged}>
                {t('done')}
              </SubmitButton>
            </form>
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}
