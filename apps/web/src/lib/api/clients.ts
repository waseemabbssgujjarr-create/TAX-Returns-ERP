import type {
  AddClientNoteBody,
  CheckDuplicateQuery,
  ClientDetail,
  CreateClientBody,
  ListClientsQuery,
  RevealClientFieldBody,
  UpdateClientBody,
} from '@taxdesk/schemas'
import {
  ClientActivityListSchema as ActivitySchema,
  DuplicateCheckResultSchema as DuplicateSchema,
  PaginatedClientsSchema as PaginatedSchema,
} from '@taxdesk/schemas'
import type { z } from 'zod'

import { apiFetch } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchClients(
  accessToken: string,
  query: Partial<ListClientsQuery> = {},
): Promise<z.infer<typeof PaginatedSchema>> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.search) params.set('search', query.search)
  if (query.type) params.set('type', query.type)
  if (query.filerStatus) params.set('filerStatus', query.filerStatus)
  if (query.archived !== undefined) params.set('archived', String(query.archived))
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.sortDir) params.set('sortDir', query.sortDir)

  const qs = params.toString()
  const data = await apiFetch<unknown>(`/clients${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(accessToken),
  })
  return PaginatedSchema.parse(data)
}

export async function fetchClient(accessToken: string, id: string): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/clients/${id}`, {
    headers: authHeaders(accessToken),
  })
}

export async function createClient(
  accessToken: string,
  body: CreateClientBody,
): Promise<ClientDetail> {
  return apiFetch<ClientDetail>('/clients', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: authHeaders(accessToken),
  })
}

export async function updateClient(
  accessToken: string,
  id: string,
  body: UpdateClientBody,
): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: authHeaders(accessToken),
  })
}

export async function archiveClient(accessToken: string, id: string): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/clients/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

export async function deleteClient(accessToken: string, id: string): Promise<void> {
  await apiFetch<void>(`/clients/${id}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
    parseJson: false,
  })
}

export async function addClientNote(
  accessToken: string,
  id: string,
  body: AddClientNoteBody,
): Promise<{ id: string; body: string; createdAt: string; authorName: string }> {
  return apiFetch(`/clients/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: authHeaders(accessToken),
  })
}

export async function fetchClientActivity(
  accessToken: string,
  id: string,
): Promise<z.infer<typeof ActivitySchema>> {
  const data = await apiFetch<unknown>(`/clients/${id}/activity`, {
    headers: authHeaders(accessToken),
  })
  return ActivitySchema.parse(data)
}

export async function revealClientField(
  accessToken: string,
  id: string,
  body: RevealClientFieldBody,
): Promise<{ field: string; value: string }> {
  return apiFetch(`/clients/${id}/reveal-field`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: authHeaders(accessToken),
  })
}

export async function checkClientDuplicate(
  accessToken: string,
  query: CheckDuplicateQuery,
): Promise<z.infer<typeof DuplicateSchema>> {
  const params = new URLSearchParams()
  if (query.cnic) params.set('cnic', query.cnic)
  if (query.ntn) params.set('ntn', query.ntn)
  if (query.excludeClientId) params.set('excludeClientId', query.excludeClientId)
  const data = await apiFetch<unknown>(`/clients/check-duplicate?${params.toString()}`, {
    headers: authHeaders(accessToken),
  })
  return DuplicateSchema.parse(data)
}
