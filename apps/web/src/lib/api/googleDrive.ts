import {
  GoogleDriveConnectStartResponseSchema,
  GoogleDriveConnectionsListSchema,
  GoogleDriveStatusSchema,
  type DisconnectGoogleDriveBody,
} from '@taxdesk/schemas'

import { apiFetch } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchGoogleDriveStatus(accessToken: string) {
  const data = await apiFetch<unknown>('/integrations/google-drive/status', {
    headers: authHeaders(accessToken),
  })
  return GoogleDriveStatusSchema.parse(data)
}

export async function startGoogleDriveConnect(accessToken: string) {
  const data = await apiFetch<unknown>('/integrations/google-drive/connect', {
    headers: authHeaders(accessToken),
  })
  return GoogleDriveConnectStartResponseSchema.parse(data)
}

export async function disconnectGoogleDrive(
  accessToken: string,
  body: DisconnectGoogleDriveBody = {},
) {
  return apiFetch<{ disconnected: true }>('/integrations/google-drive/disconnect', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
}

export async function fetchGoogleDriveConnections(accessToken: string) {
  const data = await apiFetch<unknown>('/integrations/google-drive/connections', {
    headers: authHeaders(accessToken),
  })
  return GoogleDriveConnectionsListSchema.parse(data)
}
