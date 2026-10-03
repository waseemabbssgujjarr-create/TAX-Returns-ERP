'use client'

import { cn } from '@taxdesk/ui'
import { forwardRef, useCallback, useEffect, useRef } from 'react'

export interface OtpInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'maxLength' | 'pattern'
  > {
  hasError?: boolean
  onClearSignal?: number
}

export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(function OtpInput(
  { hasError, className, onChange, onClearSignal, value, ...props },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null)

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  useEffect(() => {
    if (onClearSignal !== undefined && onClearSignal > 0) {
      innerRef.current?.focus()
    }
  }, [onClearSignal])

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    event.preventDefault()
    const target = event.currentTarget
    onChange?.({
      ...event,
      target: { ...target, value: pasted },
      currentTarget: { ...target, value: pasted },
    } as React.ChangeEvent<HTMLInputElement>)
  }

  return (
    <input
      {...props}
      ref={setRefs}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      pattern="[0-9]{6}"
      value={value}
      onChange={onChange}
      onPaste={handlePaste}
      className={cn(
        'border-border bg-surface min-h-12 w-full rounded-md border px-4 text-center text-lg tracking-[0.35em]',
        'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        hasError && 'border-error motion-safe:animate-otp-shake',
        'motion-reduce:animate-none',
        className,
      )}
      aria-invalid={hasError || undefined}
    />
  )
})
