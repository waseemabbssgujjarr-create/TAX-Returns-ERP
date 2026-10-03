'use client'

import { Button } from '@taxdesk/ui'
import { CalendarDays, Download, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { DashboardOverview } from '@/components/dashboard/DashboardOverview'
import { StaffPageHeader } from '@/components/staff/StaffPageHeader'
import { Link } from '@/i18n/navigation'
import { useAuthStore } from '@/stores/authStore'

export function DashboardPageClient() {
  const t = useTranslations('dashboard')
  const userName = useAuthStore((s) => s.user?.name?.trim())

  const greeting = userName ? t('greetingNamed', { name: userName }) : t('greetingGeneric')

  return (
    <div className="min-w-0 space-y-6">
      <StaffPageHeader
        title={greeting}
        description={t('subtitle')}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/calendar">
                <CalendarDays className="me-1.5 size-4" aria-hidden="true" />
                {t('actions.calendar')}
              </Link>
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled title={t('actions.exportSoon')}>
              <Download className="me-1.5 size-4" aria-hidden="true" />
              {t('actions.export')}
            </Button>
            <Button asChild size="sm">
              <Link href="/clients/new">
                <UserPlus className="me-1.5 size-4" aria-hidden="true" />
                {t('actions.addClient')}
              </Link>
            </Button>
          </>
        }
      />
      <DashboardOverview />
    </div>
  )
}
