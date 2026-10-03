'use client'

import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'

interface SubmitButtonProps {
  isLoading?: boolean
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function SubmitButton({ isLoading, children, className, disabled }: SubmitButtonProps) {
  const t = useTranslations('common')
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      loadingLabel={t('loading')}
      {...(className !== undefined ? { className } : {})}
      {...(isLoading !== undefined ? { isLoading } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      {children}
    </Button>
  )
}
