'use client'

import { AlertCircle } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  describedById?: string
}

export function ErrorBanner({ message, describedById }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      aria-describedby={describedById}
      className="border-error bg-error/5 text-error flex gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
