import {
  CreateExportBodySchema,
  ExportArtifactSchema,
  SignedExportDownloadSchema,
  type CreateExportBody,
} from '@taxdesk/schemas'

import { apiFetch } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function requestExport(accessToken: string, body: CreateExportBody) {
  CreateExportBodySchema.parse(body)
  const data = await apiFetch<unknown>('/exports', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return ExportArtifactSchema.parse(data)
}

export async function fetchExport(accessToken: string, id: string) {
  const data = await apiFetch<unknown>(`/exports/${id}`, {
    headers: authHeaders(accessToken),
  })
  return ExportArtifactSchema.parse(data)
}

export async function fetchExportDownloadUrl(accessToken: string, id: string) {
  const data = await apiFetch<unknown>(`/exports/${id}/download-url`, {
    headers: authHeaders(accessToken),
  })
  return SignedExportDownloadSchema.parse(data)
}
