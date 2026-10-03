import type { CreateWithholdingEntryBody, UpdateWithholdingEntryBody } from '@taxdesk/schemas'
import {
  WithholdingChecklistSchema,
  WithholdingEntrySchema,
  WithholdingReconcileResultSchema,
} from '@taxdesk/schemas'

import { apiFetch } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchWithholdingEntries(accessToken: string, taxYearFileId: string) {
  const data = await apiFetch<{ items: unknown[] }>(`/tax-years/${taxYearFileId}/withholding`, {
    headers: authHeaders(accessToken),
  })
  return {
    items: data.items.map((item) => WithholdingEntrySchema.parse(item)),
  }
}

export async function createWithholdingEntry(
  accessToken: string,
  taxYearFileId: string,
  body: CreateWithholdingEntryBody,
) {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/withholding`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return WithholdingEntrySchema.parse(data)
}

export async function updateWithholdingEntry(
  accessToken: string,
  entryId: string,
  body: UpdateWithholdingEntryBody,
) {
  const data = await apiFetch<unknown>(`/withholding/${entryId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return WithholdingEntrySchema.parse(data)
}

export async function reconcileWithholding(accessToken: string, taxYearFileId: string) {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/withholding/reconcile`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
  return WithholdingReconcileResultSchema.parse(data)
}

export async function fetchWithholdingChecklist(accessToken: string, taxYearFileId: string) {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/withholding/checklist`, {
    headers: authHeaders(accessToken),
  })
  return WithholdingChecklistSchema.parse(data)
}
