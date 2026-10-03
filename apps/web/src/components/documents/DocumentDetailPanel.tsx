'use client'

import { DocumentCategorySchema, DocumentReviewStatusSchema } from '@taxdesk/schemas'
import type { DocumentDetailSchema, UpdateDocumentBody } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import type { z } from 'zod'

import { DocumentUploadDropzone } from './DocumentUploadDropzone'

import {
  fetchDocument,
  fetchDocumentDownloadUrl,
  fetchDocumentVersions,
  updateDocument,
  uploadDocumentVersion,
} from '@/lib/api/documents'
import { useAuthStore } from '@/stores/authStore'

type DocumentDetail = z.infer<typeof DocumentDetailSchema>

type Props = {
  documentId: string
  allowEdit?: boolean
}

function statusTone(processingStatus: string, status: string): string {
  if (processingStatus === 'FAILED' || status === 'FAILED') {
    return 'text-error'
  }
  if (processingStatus === 'READY' || status === 'VERIFIED' || status === 'EXTRACTED') {
    return 'text-success'
  }
  if (processingStatus === 'PENDING' || status === 'PROCESSING' || status === 'UPLOADED') {
    return 'text-warning'
  }
  return 'text-muted-foreground'
}

export function DocumentDetailPanel({ documentId, allowEdit = true }: Props) {
  const t = useTranslations('documents')
  const locale = useLocale()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)
  const sessionType = useAuthStore((s) => s.sessionType)

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [versions, setVersions] = useState<
    Array<{ id: string; version: number; originalName: string; createdAt: string }>
  >([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const canEdit = allowEdit && sessionType === 'staff' && sessionState === 'full'

  const load = useCallback(async () => {
    if (!accessToken || sessionState !== 'full') return
    setLoading(true)
    try {
      const [detail, versionPage, signed] = await Promise.all([
        fetchDocument(accessToken, documentId),
        fetchDocumentVersions(accessToken, documentId),
        fetchDocumentDownloadUrl(accessToken, documentId),
      ])
      setDoc(detail)
      setVersions(versionPage.items)
      setPreviewUrl(signed.url)
      setError(null)
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, sessionState, documentId, t])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(body: UpdateDocumentBody) {
    if (!accessToken || !canEdit) return
    setSaving(true)
    try {
      const updated = await updateDocument(accessToken, documentId, body)
      setDoc(updated)
      setError(null)
    } catch {
      setError(t('errors.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleVersionUpload(file: File) {
    if (!accessToken || !canEdit) return
    try {
      const created = await uploadDocumentVersion(accessToken, documentId, file)
      window.location.href = `/${locale}/documents/${created.id}`
    } catch {
      setError(t('errors.uploadFailed'))
    }
  }

  if (loading) {
    return <div className="bg-surface-hover h-40 animate-pulse rounded-lg" aria-busy="true" />
  }

  if (!doc) {
    return (
      <p className="text-error text-sm" role="alert">
        {error ?? t('errors.loadFailed')}
      </p>
    )
  }

  const failed = doc.processingStatus === 'FAILED' || doc.status === 'FAILED'
  const needsReview =
    doc.reviewStatus === 'NOT_STARTED' ||
    doc.reviewStatus === 'IN_REVIEW' ||
    doc.extractionStatus === 'COMPLETE'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">
            <Link
              href={`/${locale}/documents?clientId=${doc.clientId}${doc.taxYear ? `&taxYear=${doc.taxYear}` : ''}`}
              className="underline-offset-2 hover:underline"
            >
              {t('backToList')}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{doc.originalName}</h1>
          <p className={`mt-1 text-sm ${statusTone(doc.processingStatus, doc.status)}`}>
            {t(`processingStatus.${doc.processingStatus}`)} · {t(`status.${doc.status}`)} · v
            {doc.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {previewUrl && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
            >
              {t('preview')}
            </Button>
          )}
          {previewUrl && (
            <Button
              type="button"
              onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
            >
              {t('download')}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}

      {failed && (
        <div
          className="border-error/40 bg-error/5 rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          <p className="text-error font-medium">{t('failed.title')}</p>
          <p className="text-muted-foreground mt-1">{t('failed.description')}</p>
        </div>
      )}

      {!failed && needsReview && (
        <div
          className="border-warning/40 bg-warning/5 rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium">{t('review.banner')}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2" aria-label={t('detail.meta')}>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('columns.category')}</span>
          <select
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            disabled={!canEdit || saving}
            value={doc.category}
            onChange={(e) => {
              const category = DocumentCategorySchema.parse(e.target.value)
              void patch({ category })
            }}
          >
            {DocumentCategorySchema.options.map((value) => (
              <option key={value} value={value}>
                {t(`category.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">{t('columns.review')}</span>
          <select
            className="border-border bg-surface w-full rounded-md border px-3 py-2"
            disabled={!canEdit || saving}
            value={doc.reviewStatus}
            onChange={(e) => {
              const reviewStatus = DocumentReviewStatusSchema.parse(e.target.value)
              void patch({
                reviewStatus,
                ...(reviewStatus === 'APPROVED' ? { status: 'REVIEWED' as const } : {}),
              })
            }}
          >
            {DocumentReviewStatusSchema.options.map((value) => (
              <option key={value} value={value}>
                {t(`reviewStatus.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm">
          <p className="text-muted-foreground">{t('taxYearLabel')}</p>
          <p className="mt-1 font-medium">{doc.taxYear ?? '—'}</p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground">{t('columns.extraction')}</p>
          <p className="mt-1 font-medium">{t(`extractionStatus.${doc.extractionStatus}`)}</p>
        </div>
      </section>

      <section aria-labelledby="extracted-heading" className="space-y-2">
        <h2 id="extracted-heading" className="text-lg font-medium">
          {t('extracted.title')}
        </h2>
        {doc.extractedFields == null ? (
          <p className="text-muted-foreground text-sm">{t('extracted.empty')}</p>
        ) : (
          <pre className="border-border bg-surface-hover overflow-x-auto rounded-lg border p-3 text-xs">
            {JSON.stringify(doc.extractedFields, null, 2)}
          </pre>
        )}
      </section>

      <section aria-labelledby="versions-heading" className="space-y-3">
        <h2 id="versions-heading" className="text-lg font-medium">
          {t('versions.title')}
        </h2>
        <ul className="divide-border border-border divide-y rounded-lg border" role="list">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <p className="font-medium">
                  v{v.version} · {v.originalName}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(v.createdAt).toLocaleString(locale)}
                </p>
              </div>
              {v.id !== doc.id && (
                <Link
                  href={`/${locale}/documents/${v.id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {t('versions.open')}
                </Link>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <div>
            <p className="text-muted-foreground mb-2 text-sm">{t('versions.uploadHint')}</p>
            <DocumentUploadDropzone onUpload={handleVersionUpload} />
          </div>
        )}
      </section>
    </div>
  )
}
