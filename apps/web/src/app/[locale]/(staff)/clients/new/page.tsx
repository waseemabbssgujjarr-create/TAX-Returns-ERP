'use client'

import { useParams, useRouter } from 'next/navigation'

import { ClientForm } from '@/components/clients/ClientForm'
import { StaffPanel } from '@/components/staff/StaffPanel'

export default function NewClientPage() {
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()

  return (
    <StaffPanel>
      <ClientForm mode="create" onSaved={(id) => router.push(`/${locale}/clients/${id}`)} />
    </StaffPanel>
  )
}
