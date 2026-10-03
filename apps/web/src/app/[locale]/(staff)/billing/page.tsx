'use client'

import { useCallback } from 'react'

import { StaffResourceList } from '@/components/staff/StaffResourceList'
import { fetchInvoices } from '@/lib/api/staffLists'

export default function BillingPage() {
  const fetchItems = useCallback((token: string) => fetchInvoices(token), [])

  return (
    <StaffResourceList
      namespace="billing"
      fetchItems={fetchItems}
      emptyActionHref="clients"
      columns={[
        { key: 'invoiceNumber', labelKey: 'columns.number' },
        { key: 'amountPaisa', labelKey: 'columns.amount' },
        { key: 'status', labelKey: 'columns.status' },
      ]}
    />
  )
}
