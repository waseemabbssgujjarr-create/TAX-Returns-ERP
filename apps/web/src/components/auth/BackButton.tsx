'use client'

import { ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

interface BackButtonProps {
  href: string
  label: string
}

export function BackButton({ href, label }: BackButtonProps) {
  const t = useTranslations('common')
  return (
    <Link
      href={href}
      className="text-primary focus-visible:ring-primary mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <ChevronLeft className="back-icon size-4 rtl:scale-x-[-1]" aria-hidden="true" />
      <span>{label || t('back')}</span>
    </Link>
  )
}
