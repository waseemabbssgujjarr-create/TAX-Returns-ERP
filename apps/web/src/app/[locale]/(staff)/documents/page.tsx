import { Suspense } from 'react'

import { DocumentsPageContent } from '@/components/documents/DocumentsPageContent'

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6" aria-busy="true">
          <div className="bg-surface-hover h-8 w-48 animate-pulse rounded-md" />
          <div className="bg-surface-hover h-40 max-w-lg animate-pulse rounded-lg" />
        </div>
      }
    >
      <DocumentsPageContent />
    </Suspense>
  )
}
