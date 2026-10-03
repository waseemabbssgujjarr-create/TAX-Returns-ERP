import {
  AdminSessionsListSchema,
  AdminUsersListSchema,
  FirmSettingsSchema,
  PaginatedAuditLogsSchema,
  type ListAuditLogsQuery,
  type PatchFirmSettingsBody,
  type PatchUserRoleBody,
  type RevokeSessionBody,
} from '@taxdesk/schemas'

import { apiFetch } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchAdminUsers(accessToken: string) {
  const data = await apiFetch<unknown>('/admin/users', { headers: authHeaders(accessToken) })
  return AdminUsersListSchema.parse(data)
}

export async function patchAdminUserRole(
  accessToken: string,
  userId: string,
  body: PatchUserRoleBody,
) {
  const data = await apiFetch<unknown>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return data
}

export async function fetchAdminSessions(accessToken: string) {
  const data = await apiFetch<unknown>('/admin/sessions', { headers: authHeaders(accessToken) })
  return AdminSessionsListSchema.parse(data)
}

export async function revokeAdminSession(
  accessToken: string,
  sessionId: string,
  body: RevokeSessionBody = {},
) {
  return apiFetch<{ revoked: boolean }>(`/admin/sessions/${sessionId}/revoke`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
}

export async function fetchAdminAuditLogs(
  accessToken: string,
  query: Partial<ListAuditLogsQuery> = {},
) {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.userId) params.set('userId', query.userId)
  if (query.action) params.set('action', query.action)
  if (query.resourceType) params.set('resourceType', query.resourceType)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  const qs = params.toString()
  const data = await apiFetch<unknown>(`/admin/audit-logs${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(accessToken),
  })
  return PaginatedAuditLogsSchema.parse(data)
}

export async function fetchFirmSettings(accessToken: string) {
  const data = await apiFetch<unknown>('/admin/firm-settings', {
    headers: authHeaders(accessToken),
  })
  return FirmSettingsSchema.parse(data)
}

export async function patchFirmSettings(accessToken: string, body: PatchFirmSettingsBody) {
  const data = await apiFetch<unknown>('/admin/firm-settings', {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  return FirmSettingsSchema.parse(data)
}
