'use client'

import { CheckCircle2 } from 'lucide-react'

interface SuccessBannerProps {
  message: string
}

export function SuccessBanner({ message }: SuccessBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-success bg-success/5 text-success flex gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
