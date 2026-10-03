'use client'

import { useParams } from 'next/navigation'

import { DocumentDetailPanel } from '@/components/documents/DocumentDetailPanel'

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>()
  const documentId = params.id

  if (!documentId) {
    return null
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <DocumentDetailPanel documentId={documentId} allowEdit />
    </div>
  )
}
