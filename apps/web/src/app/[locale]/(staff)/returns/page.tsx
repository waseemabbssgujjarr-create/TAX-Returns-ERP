'use client'

import { useCallback } from 'react'

import { StaffResourceList } from '@/components/staff/StaffResourceList'
import { fetchAllTaxYears } from '@/lib/api/staffLists'

export default function ReturnsPage() {
  const fetchItems = useCallback(async (token: string) => {
    const page = await fetchAllTaxYears(token)
    return {
      items: page.items.map((item) => ({
        id: item.id,
        client: item.clientName,
        taxYear: String(item.taxYear),
        status: item.status,
        dueDate: item.dueDate,
        overdue: item.overdue ? '1' : null,
        filingStatus: item.filingStatus ?? 'NOT_STARTED',
      })),
    }
  }, [])

  return (
    <StaffResourceList
      namespace="returns"
      fetchItems={fetchItems}
      emptyActionHref="clients"
      columns={[
        { key: 'client', labelKey: 'columns.client' },
        { key: 'taxYear', labelKey: 'columns.taxYear' },
        { key: 'status', labelKey: 'columns.status' },
        { key: 'filingStatus', labelKey: 'columns.filingStatus' },
        { key: 'dueDate', labelKey: 'columns.dueDate' },
      ]}
    />
  )
}
