'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Route-level error boundary.
 * Shown when an unhandled error is thrown in a Server Component.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations('errors')

  useEffect(() => {
    // Log to error tracking (Sentry) in production
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <main
      id="main-content"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <p className="text-5xl" role="img" aria-label="Error">
        ⚠️
      </p>
      <h2 className="text-foreground text-xl font-semibold">{t('unexpected.title')}</h2>
      <p className="text-muted-foreground text-sm">{t('unexpected.description')}</p>
      <button
        type="button"
        onClick={reset}
        className="bg-primary hover:bg-primary-hover focus-visible:ring-primary mt-2 rounded-md px-4 py-2 text-sm font-medium text-white focus-visible:ring-2"
      >
        {t('unexpected.action')}
      </button>
    </main>
  )
}
