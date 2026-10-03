'use client'

import type { DocumentSummarySchema } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import type { z } from 'zod'

import { DocumentUploadDropzone } from './DocumentUploadDropzone'

import {
  deleteDocument,
  fetchDocumentDownloadUrl,
  fetchDocuments,
  uploadDocument,
} from '@/lib/api/documents'
import { useAuthStore } from '@/stores/authStore'

type DocumentSummary = z.infer<typeof DocumentSummarySchema>

type Props = {
  clientId: string
  taxYear?: number
  showUpload?: boolean
  compact?: boolean
  /** Portal sessions: hide delete/staff-only actions; link detail within portal when applicable. */
  portalMode?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusClass(processingStatus: string, status: string): string {
  if (processingStatus === 'FAILED' || status === 'FAILED') return 'text-error'
  if (processingStatus === 'READY' || status === 'VERIFIED') return 'text-success'
  if (status === 'PROCESSING' || processingStatus === 'PENDING') return 'text-warning'
  return ''
}

export function DocumentsList({
  clientId,
  taxYear = new Date().getFullYear(),
  showUpload = true,
  compact = false,
  portalMode = false,
}: Props) {
  const t = useTranslations('documents')
  const locale = useLocale()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)

  const [items, setItems] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!accessToken || sessionState !== 'full') return
    setLoading(true)
    try {
      const page = await fetchDocuments(accessToken, {
        clientId,
        taxYear,
        page: 1,
        pageSize: compact ? 5 : 20,
      })
      setItems(page.items)
      setError(null)
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, sessionState, clientId, taxYear, compact, t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleUpload(file: File) {
    if (!accessToken) return
    setUploading(true)
    try {
      await uploadDocument(accessToken, file, { clientId, taxYear })
      await load()
    } catch {
      setError(t('errors.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(id: string) {
    if (!accessToken) return
    const { url } = await fetchDocumentDownloadUrl(accessToken, id)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete(id: string) {
    if (!accessToken || portalMode || !window.confirm(t('deleteConfirm'))) return
    await deleteDocument(accessToken, id)
    await load()
  }

  if (loading) {
    return <div className="bg-surface-hover h-24 animate-pulse rounded-lg" aria-busy="true" />
  }

  return (
    <section aria-labelledby="documents-list-heading" className="space-y-4">
      <h2 id="documents-list-heading" className="text-lg font-medium">
        {compact ? t('clientSectionTitle') : t('title')}
      </h2>

      {showUpload && (
        <DocumentUploadDropzone
          disabled={sessionState !== 'full' || uploading}
          onUpload={handleUpload}
        />
      )}

      {uploading && (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {t('uploadStates.uploading')}
        </p>
      )}

      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="border-border rounded-lg border px-4 py-8 text-center">
          <p className="font-medium">{t('empty.title')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('empty.description')}</p>
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-hover text-start">
              <tr>
                <th className="px-3 py-2 font-medium">{t('columns.name')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.status')}</th>
                {!compact && <th className="px-3 py-2 font-medium">{t('columns.category')}</th>}
                <th className="px-3 py-2 font-medium">{t('columns.size')}</th>
                <th className="sr-only px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc) => (
                <tr key={doc.id} className="border-border border-t">
                  <td className="px-3 py-2">
                    {portalMode ? (
                      doc.originalName
                    ) : (
                      <Link
                        href={`/${locale}/documents/${doc.id}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {doc.originalName}
                      </Link>
                    )}
                    <span className="text-muted-foreground ms-2 text-xs">v{doc.version}</span>
                  </td>
                  <td className={`px-3 py-2 ${statusClass(doc.processingStatus, doc.status)}`}>
                    {t(`processingStatus.${doc.processingStatus}`)}
                    {doc.reviewStatus === 'IN_REVIEW' && (
                      <span className="ms-1 text-xs">({t('reviewStatus.IN_REVIEW')})</span>
                    )}
                  </td>
                  {!compact && <td className="px-3 py-2">{t(`category.${doc.category}`)}</td>}
                  <td className="px-3 py-2">{formatBytes(doc.sizeBytes)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-8 px-2 text-xs"
                        onClick={() => void handleDownload(doc.id)}
                      >
                        {t('download')}
                      </Button>
                      {!portalMode && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 px-2 text-xs"
                          onClick={() => void handleDelete(doc.id)}
                        >
                          {t('delete')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
