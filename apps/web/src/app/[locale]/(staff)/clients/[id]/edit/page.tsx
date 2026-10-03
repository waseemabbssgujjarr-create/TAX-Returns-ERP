'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ClientForm } from '@/components/clients/ClientForm'
import { fetchClient } from '@/lib/api/clients'
import { useAuthStore } from '@/stores/authStore'

export default function EditClientPage() {
  const router = useRouter()
  const { locale, id: clientId } = useParams<{ locale: string; id: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [initial, setInitial] = useState<{
    displayName: string
    type: string
    filerStatus: string
  } | null>(null)

  useEffect(() => {
    if (!accessToken || !clientId) return
    void fetchClient(accessToken, clientId).then((c) => {
      setInitial({
        displayName: c.displayName,
        type: c.type,
        filerStatus: c.filerStatus,
      })
    })
  }, [accessToken, clientId])

  if (!initial || !clientId) {
    return <div className="bg-surface-hover h-40 animate-pulse rounded-lg" aria-busy="true" />
  }

  return (
    <ClientForm
      mode="edit"
      clientId={clientId}
      initial={initial as never}
      onSaved={() => router.push(`/${locale}/clients/${clientId}`)}
    />
  )
}
