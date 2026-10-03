import type { ReactNode } from 'react'

import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingNav } from '@/components/marketing/MarketingNav'

import '@/styles/marketing.css'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell flex min-h-svh flex-col overflow-x-hidden">
      <MarketingNav />

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>

      <MarketingFooter />
    </div>
  )
}
