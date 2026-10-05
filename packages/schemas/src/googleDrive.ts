import { z } from 'zod'

/**
 * Google Drive per-user storage integration — API contracts shared by
 * apps/worker (NestJS) and apps/web (Next.js Settings → Storage UI).
 *
 * Security notes:
 *   - Never includes refresh tokens, access tokens, or wrapped data keys.
 *   - Never includes a Drive file/folder "web view" link — downloads are
 *     always proxied through the worker (no public Drive links).
 */

export const GoogleDriveConnectionStatusSchema = z.enum(['CONNECTED', 'REVOKED', 'ERROR'])
export type GoogleDriveConnectionStatus = z.infer<typeof GoogleDriveConnectionStatusSchema>

export const GoogleDriveStatusSchema = z.object({
  connected: z.boolean(),
  status: GoogleDriveConnectionStatusSchema.nullable(),
  googleAccountEmail: z.string().email().nullable(),
  connectedAt: z.string().datetime().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  isDefault: z.boolean(),
  lastErrorMessage: z.string().nullable(),
})

export type GoogleDriveStatus = z.infer<typeof GoogleDriveStatusSchema>

export const GoogleDriveConnectStartResponseSchema = z.object({
  authUrl: z.string().url(),
})

export type GoogleDriveConnectStartResponse = z.infer<typeof GoogleDriveConnectStartResponseSchema>

export const GoogleDriveDisconnectResponseSchema = z.object({
  disconnected: z.literal(true),
})

export const DisconnectGoogleDriveBodySchema = z.object({
  reason: z.string().max(200).optional(),
})

export type DisconnectGoogleDriveBody = z.infer<typeof DisconnectGoogleDriveBodySchema>

/** OWNER/MANAGER oversight list — never includes secrets. */
export const GoogleDriveConnectionSummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userName: z.string(),
  userEmail: z.string().email(),
  googleAccountEmail: z.string().email(),
  status: GoogleDriveConnectionStatusSchema,
  isDefault: z.boolean(),
  connectedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime().nullable(),
})

export type GoogleDriveConnectionSummary = z.infer<typeof GoogleDriveConnectionSummarySchema>

export const GoogleDriveConnectionsListSchema = z.object({
  items: z.array(GoogleDriveConnectionSummarySchema),
})

export type GoogleDriveConnectionsList = z.infer<typeof GoogleDriveConnectionsListSchema>
