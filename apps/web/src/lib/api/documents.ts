import {
  DocumentDetailSchema,
  DocumentVersionsResponseSchema,
  PaginatedDocumentsSchema,
  SignedDownloadUrlSchema,
} from '@taxdesk/schemas'
import type { ListDocumentsQuery, UpdateDocumentBody } from '@taxdesk/schemas'
import type { z } from 'zod'

import { apiFetch, getApiBaseUrl } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchDocuments(
  accessToken: string,
  query: ListDocumentsQuery,
): Promise<z.infer<typeof PaginatedDocumentsSchema>> {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  if (query.clientId) params.set('clientId', query.clientId)
  if (query.taxYear !== undefined) params.set('taxYear', String(query.taxYear))

  const data = await apiFetch<unknown>(`/documents?${params.toString()}`, {
    headers: authHeaders(accessToken),
  })
  return PaginatedDocumentsSchema.parse(data)
}

export async function fetchDocument(
  accessToken: string,
  documentId: string,
): Promise<z.infer<typeof DocumentDetailSchema>> {
  const data = await apiFetch<unknown>(`/documents/${documentId}`, {
    headers: authHeaders(accessToken),
  })
  return DocumentDetailSchema.parse(data)
}

export async function fetchDocumentVersions(
  accessToken: string,
  documentId: string,
): Promise<z.infer<typeof DocumentVersionsResponseSchema>> {
  const data = await apiFetch<unknown>(`/documents/${documentId}/versions`, {
    headers: authHeaders(accessToken),
  })
  return DocumentVersionsResponseSchema.parse(data)
}

export async function uploadDocument(
  accessToken: string,
  file: File,
  fields: { clientId?: string; taxYear: number },
): Promise<z.infer<typeof DocumentDetailSchema>> {
  const base = getApiBaseUrl()
  const form = new FormData()
  form.append('file', file)
  if (fields.clientId) form.append('clientId', fields.clientId)
  form.append('taxYear', String(fields.taxYear))

  const res = await fetch(`${base}/documents/upload`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: authHeaders(accessToken),
  })

  if (!res.ok) {
    throw new Error('Upload failed')
  }

  return DocumentDetailSchema.parse(await res.json())
}

export async function uploadDocumentVersion(
  accessToken: string,
  documentId: string,
  file: File,
): Promise<z.infer<typeof DocumentDetailSchema>> {
  const base = getApiBaseUrl()
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${base}/documents/${documentId}/versions`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: authHeaders(accessToken),
  })

  if (!res.ok) {
    throw new Error('Version upload failed')
  }

  return DocumentDetailSchema.parse(await res.json())
}

export async function updateDocument(
  accessToken: string,
  documentId: string,
  body: UpdateDocumentBody,
): Promise<z.infer<typeof DocumentDetailSchema>> {
  const data = await apiFetch<unknown>(`/documents/${documentId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return DocumentDetailSchema.parse(data)
}

export async function fetchDocumentDownloadUrl(
  accessToken: string,
  documentId: string,
): Promise<z.infer<typeof SignedDownloadUrlSchema>> {
  const data = await apiFetch<unknown>(`/documents/${documentId}/download-url`, {
    headers: authHeaders(accessToken),
  })
  return SignedDownloadUrlSchema.parse(data)
}

export async function deleteDocument(accessToken: string, documentId: string): Promise<void> {
  await apiFetch<void>(`/documents/${documentId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
    parseJson: false,
  })
}
