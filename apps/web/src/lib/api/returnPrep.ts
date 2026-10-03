import {
  ApproveReturnPrepBodySchema,
  DemoteReturnPrepBodySchema,
  ReturnPrepActivityItemSchema,
  ReturnPreparationSchema,
  type ApproveReturnPrepBody,
  type DemoteReturnPrepBody,
  type UpsertReturnPreparationBody,
} from '@taxdesk/schemas'
import type { z } from 'zod'

import { apiFetch } from './base'

type ReturnPreparation = z.infer<typeof ReturnPreparationSchema>

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchReturnPrep(accessToken: string, taxYearFileId: string) {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/return-prep`, {
    headers: authHeaders(accessToken),
  })
  if (data == null) return null
  return ReturnPreparationSchema.parse(data)
}

export async function upsertReturnPrep(
  accessToken: string,
  taxYearFileId: string,
  body: UpsertReturnPreparationBody,
) {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/return-prep`, {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return ReturnPreparationSchema.parse(data)
}

export async function assembleReturnPrep(accessToken: string, taxYearFileId: string) {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/return-prep/assemble`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
  return ReturnPreparationSchema.parse(data)
}

export async function submitReturnPrepReview(accessToken: string, taxYearFileId: string) {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/return-prep/submit-review`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
  return ReturnPreparationSchema.parse(data)
}

export async function approveReturnPrep(
  accessToken: string,
  taxYearFileId: string,
  body: ApproveReturnPrepBody = {},
) {
  ApproveReturnPrepBodySchema.parse(body)
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/return-prep/approve`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return ReturnPreparationSchema.parse(data)
}

export async function demoteReturnPrep(
  accessToken: string,
  taxYearFileId: string,
  body: DemoteReturnPrepBody,
) {
  DemoteReturnPrepBodySchema.parse(body)
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/return-prep/demote`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return ReturnPreparationSchema.parse(data)
}

export async function fetchReturnPrepActivity(accessToken: string, taxYearFileId: string) {
  const data = await apiFetch<unknown[]>(`/tax-years/${taxYearFileId}/return-prep/activity`, {
    headers: authHeaders(accessToken),
  })
  return data.map((item) => ReturnPrepActivityItemSchema.parse(item))
}

export type { ReturnPreparation }
