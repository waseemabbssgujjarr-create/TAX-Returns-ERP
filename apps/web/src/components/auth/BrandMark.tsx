'use client'

import { BrandLogo } from '@/components/marketing/BrandLogo'
import { Link } from '@/i18n/navigation'

export function BrandMark() {
  return (
    <Link
      href="/"
      className="focus-visible:ring-primary rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <BrandLogo size="md" />
    </Link>
  )
}
