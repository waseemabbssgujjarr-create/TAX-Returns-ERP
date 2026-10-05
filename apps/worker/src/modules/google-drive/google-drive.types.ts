/** Shared types for the Google Drive per-user storage integration. */

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface ExchangedTokens {
  accessToken: string
  /** Only present on first consent (prompt=consent, access_type=offline). */
  refreshToken?: string
  expiresInSeconds: number
  scope: string
}

export interface RefreshedAccessToken {
  accessToken: string
  expiresInSeconds: number
}

export interface GoogleUserInfo {
  email: string
}

export interface DriveFile {
  id: string
  name: string
}

export class GoogleDriveApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'GoogleDriveApiError'
  }
}

/** Minimal fetch-compatible signature so adapters can be unit tested without real network calls. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string | Buffer | Uint8Array
  },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  arrayBuffer: () => Promise<ArrayBuffer>
  text: () => Promise<string>
}>
