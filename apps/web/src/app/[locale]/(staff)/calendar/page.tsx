'use client'

import { useCallback } from 'react'

import { PenaltyCalculatorWidget } from '@/components/compliance/PenaltyCalculatorWidget'
import { StaffResourceList } from '@/components/staff/StaffResourceList'
import { fetchComplianceEvents } from '@/lib/api/staffLists'

export default function CalendarPage() {
  const fetchItems = useCallback((token: string) => fetchComplianceEvents(token), [])

  return (
    <div className="space-y-6">
      <StaffResourceList
        namespace="calendar"
        fetchItems={fetchItems}
        emptyActionHref="clients"
        columns={[
          { key: 'title', labelKey: 'columns.title' },
          { key: 'kind', labelKey: 'columns.kind' },
          { key: 'eventAt', labelKey: 'columns.eventAt' },
        ]}
      />
      <PenaltyCalculatorWidget />
    </div>
  )
}
