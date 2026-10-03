import type { UpsertWealthStatementBody, WealthStatementDto } from '@taxdesk/schemas'

import { apiFetch } from './base'

export async function fetchWealthStatement(
  accessToken: string,
  taxYearFileId: string,
): Promise<WealthStatementDto | null> {
  return apiFetch<WealthStatementDto | null>(`/tax-years/${taxYearFileId}/wealth`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function upsertWealthStatement(
  accessToken: string,
  taxYearFileId: string,
  body: UpsertWealthStatementBody,
): Promise<WealthStatementDto> {
  return apiFetch<WealthStatementDto>(`/tax-years/${taxYearFileId}/wealth`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  })
}
