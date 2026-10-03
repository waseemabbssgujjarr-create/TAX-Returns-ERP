import type { CreateTaxYearBody, TaxYearDetail, UpdateTaxYearBody } from '@taxdesk/schemas'

import { apiFetch } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchClientTaxYears(
  accessToken: string,
  clientId: string,
  page = 1,
  pageSize = 20,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetch<{
    items: Array<{
      id: string
      clientId: string
      taxYear: number
      status: string
      rulesVersion: string | null
    }>
    total: number
  }>(`/clients/${clientId}/tax-years?${params}`, {
    headers: authHeaders(accessToken),
  })
}

export async function fetchTaxYear(accessToken: string, taxYearFileId: string) {
  return apiFetch<TaxYearDetail>(`/tax-years/${taxYearFileId}`, {
    headers: authHeaders(accessToken),
  })
}

export async function createTaxYear(
  accessToken: string,
  clientId: string,
  body: CreateTaxYearBody,
) {
  return apiFetch<TaxYearDetail>(`/clients/${clientId}/tax-years`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
}

export async function updateTaxYear(
  accessToken: string,
  taxYearFileId: string,
  body: UpdateTaxYearBody,
) {
  return apiFetch<TaxYearDetail>(`/tax-years/${taxYearFileId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
}

export async function computeTaxYear(accessToken: string, taxYearFileId: string) {
  return apiFetch<{
    snapshotId: string
    status: string
    rulesVersion: string | null
    warnings: Array<{ code: string; message: string }>
    validationErrors: Array<{ code: string; message: string }>
    breakdown: Array<{
      labelKey: string
      valuePaisa: string
      ruleIds: string[]
      note?: string
      children?: unknown[]
    }>
    taxPayablePaisa: string | null
    netTaxPaisa: string | null
    taxableIncomePaisa: string | null
  }>(`/tax-years/${taxYearFileId}/compute`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}
