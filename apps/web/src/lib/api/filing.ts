import {
  FilingActivityItemSchema,
  IrisFilingSchema,
  RecordManualIrisReferenceBodySchema,
  SubmitIrisFilingBodySchema,
  type FilingActivityItem,
  type IrisFilingDto,
  type RecordManualIrisReferenceBody,
  type SubmitIrisFilingBody,
} from '@taxdesk/schemas'

import { apiFetch } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchFiling(
  accessToken: string,
  taxYearFileId: string,
): Promise<IrisFilingDto | null> {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/filing`, {
    headers: authHeaders(accessToken),
  })
  if (data == null) return null
  return IrisFilingSchema.parse(data)
}

export async function prepareFiling(
  accessToken: string,
  taxYearFileId: string,
): Promise<IrisFilingDto> {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/filing/prepare`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
  return IrisFilingSchema.parse(data)
}

export async function submitFiling(
  accessToken: string,
  taxYearFileId: string,
  body: SubmitIrisFilingBody = {},
): Promise<IrisFilingDto> {
  SubmitIrisFilingBodySchema.parse(body)
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/filing/submit`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return IrisFilingSchema.parse(data)
}

export async function recordManualIrisReference(
  accessToken: string,
  taxYearFileId: string,
  body: RecordManualIrisReferenceBody,
): Promise<IrisFilingDto> {
  RecordManualIrisReferenceBodySchema.parse(body)
  const data = await apiFetch<unknown>(
    `/tax-years/${taxYearFileId}/filing/record-manual-reference`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(body),
    },
  )
  return IrisFilingSchema.parse(data)
}

export async function refreshFilingStatus(
  accessToken: string,
  taxYearFileId: string,
): Promise<IrisFilingDto> {
  const data = await apiFetch<unknown>(`/tax-years/${taxYearFileId}/filing/refresh-status`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
  return IrisFilingSchema.parse(data)
}

export async function fetchFilingActivity(
  accessToken: string,
  taxYearFileId: string,
): Promise<FilingActivityItem[]> {
  const data = await apiFetch<unknown[]>(`/tax-years/${taxYearFileId}/filing/activity`, {
    headers: authHeaders(accessToken),
  })
  return data.map((item) => FilingActivityItemSchema.parse(item))
}
