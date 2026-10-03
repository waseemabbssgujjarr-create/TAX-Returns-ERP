'use client'

import { useEffect, useState } from 'react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

const COPY = {
  en: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
    action: 'Try again',
  },
  ur: {
    title: 'کچھ غلط ہو گیا',
    description: 'غیر متوقع خرابی۔ دوبارہ کوشش کریں۔',
    action: 'دوبارہ کوشش کریں',
  },
} as const

/**
 * Route-level error boundary.
 * Avoids next-intl hooks so this still renders if i18n or the root layout failed.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const [locale, setLocale] = useState<'en' | 'ur'>('en')

  useEffect(() => {
    console.error('[ErrorBoundary]', error)
    const lang = document.documentElement.lang
    if (lang === 'ur') setLocale('ur')
  }, [error])

  const copy = COPY[locale]

  return (
    <main
      id="main-content"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <p className="text-5xl" role="img" aria-label="Error">
        ⚠️
      </p>
      <h2 className="text-foreground text-xl font-semibold">{copy.title}</h2>
      <p className="text-muted-foreground text-sm">{copy.description}</p>
      <button
        type="button"
        onClick={reset}
        className="bg-primary hover:bg-primary-hover focus-visible:ring-primary mt-2 rounded-md px-4 py-2 text-sm font-medium text-white focus-visible:ring-2"
      >
        {copy.action}
      </button>
    </main>
  )
}
