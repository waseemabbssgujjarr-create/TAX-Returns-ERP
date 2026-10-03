'use client'

import { useEffect } from 'react'

import '@/styles/globals.css'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root error boundary — must define its own html/body and avoid providers
 * (layout may have crashed). Static copy only; no next-intl dependency.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  const lang =
    typeof document !== 'undefined' && document.documentElement.lang === 'ur' ? 'ur' : 'en'

  const copy =
    lang === 'ur'
      ? {
          title: 'کچھ غلط ہو گیا',
          description: 'غیر متوقع خرابی۔ دوبارہ کوشش کریں۔',
          action: 'دوبارہ کوشش کریں',
        }
      : {
          title: 'Something went wrong',
          description: 'An unexpected error occurred. Please try again.',
          action: 'Try again',
        }

  return (
    <html lang={lang}>
      <body className="font-sans antialiased">
        <main
          id="main-content"
          className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center"
        >
          <p className="text-5xl" role="img" aria-label="Error">
            ⚠️
          </p>
          <h1 className="text-foreground text-xl font-semibold">{copy.title}</h1>
          <p className="text-muted-foreground text-sm">{copy.description}</p>
          <button
            type="button"
            onClick={reset}
            className="bg-primary hover:bg-primary-hover focus-visible:ring-primary mt-2 rounded-md px-4 py-2 text-sm font-medium text-white focus-visible:ring-2"
          >
            {copy.action}
          </button>
        </main>
      </body>
    </html>
  )
}
