import { randomBytes } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import {
  GOOGLE_DRIVE_FILES_URL,
  GOOGLE_DRIVE_OAUTH_SCOPE,
  GOOGLE_DRIVE_UPLOAD_URL,
  GOOGLE_FOLDER_MIME_TYPE,
  GOOGLE_OAUTH_AUTHORIZE_URL,
  GOOGLE_OAUTH_REVOKE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_USERINFO_URL,
} from './google-drive.constants'
import {
  GoogleDriveApiError,
  type DriveFile,
  type ExchangedTokens,
  type FetchLike,
  type GoogleOAuthConfig,
  type GoogleUserInfo,
  type RefreshedAccessToken,
} from './google-drive.types'

/**
 * Thin REST wrapper around Google OAuth2 + Drive v3 using the platform
 * `fetch` (Node >= 18) — deliberately avoids the `googleapis` SDK to keep
 * the dependency surface small and the adapter trivially mockable in tests.
 */
@Injectable()
export class GoogleDriveApiClient {
  // Plain field default (not a constructor dependency) — keeps this class
  // trivially Nest-instantiable (zero-arg constructor) while still letting
  // unit tests swap in a mock via setFetchImpl().
  private fetchFn: FetchLike = fetch as unknown as FetchLike

  /** Test-only hook — swap the HTTP implementation without a live network call. */
  setFetchImpl(fn: FetchLike): void {
    this.fetchFn = fn
  }

  buildAuthUrl(config: GoogleOAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: GOOGLE_DRIVE_OAUTH_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
      include_granted_scopes: 'true',
    })
    return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`
  }

  async exchangeCode(config: GoogleOAuthConfig, code: string): Promise<ExchangedTokens> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code,
    })
    const res = await this.fetchFn(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const json = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      scope?: string
      error?: string
      error_description?: string
    }
    if (!res.ok || !json.access_token) {
      throw new GoogleDriveApiError(
        json.error_description ?? json.error ?? 'Google token exchange failed',
        res.status,
        json,
      )
    }
    return {
      accessToken: json.access_token,
      ...(json.refresh_token ? { refreshToken: json.refresh_token } : {}),
      expiresInSeconds: json.expires_in ?? 3600,
      scope: json.scope ?? GOOGLE_DRIVE_OAUTH_SCOPE,
    }
  }

  async refreshAccessToken(
    config: GoogleOAuthConfig,
    refreshToken: string,
  ): Promise<RefreshedAccessToken> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    const res = await this.fetchFn(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const json = (await res.json()) as {
      access_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    }
    if (!res.ok || !json.access_token) {
      throw new GoogleDriveApiError(
        json.error_description ?? json.error ?? 'Google access token refresh failed',
        res.status,
        json,
      )
    }
    return { accessToken: json.access_token, expiresInSeconds: json.expires_in ?? 3600 }
  }

  async revokeToken(token: string): Promise<void> {
    await this.fetchFn(GOOGLE_OAUTH_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    }).catch(() => undefined)
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await this.fetchFn(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = (await res.json()) as { email?: string }
    if (!res.ok || !json.email) {
      throw new GoogleDriveApiError('Failed to fetch Google account email', res.status, json)
    }
    return { email: json.email }
  }

  async findFolder(
    accessToken: string,
    name: string,
    parentId?: string,
  ): Promise<DriveFile | null> {
    const escapedName = name.replace(/'/g, "\\'")
    const parentClause = parentId ? ` and '${parentId}' in parents` : ""
    const q = `mimeType = '${GOOGLE_FOLDER_MIME_TYPE}' and name = '${escapedName}' and trashed = false${parentClause}`
    const params = new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '1' })
    const res = await this.fetchFn(`${GOOGLE_DRIVE_FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = (await res.json()) as { files?: DriveFile[]; error?: { message?: string } }
    if (!res.ok) {
      throw new GoogleDriveApiError(json.error?.message ?? 'Drive folder search failed', res.status, json)
    }
    return json.files?.[0] ?? null
  }

  async createFolder(accessToken: string, name: string, parentId?: string): Promise<DriveFile> {
    const res = await this.fetchFn(`${GOOGLE_DRIVE_FILES_URL}?fields=id,name`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: GOOGLE_FOLDER_MIME_TYPE,
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    })
    const json = (await res.json()) as DriveFile & { error?: { message?: string } }
    if (!res.ok || !json.id) {
      throw new GoogleDriveApiError(
        json.error?.message ?? 'Drive folder creation failed',
        res.status,
        json,
      )
    }
    return { id: json.id, name: json.name }
  }

  /** Idempotent find-or-create for a single folder level. */
  async ensureFolder(accessToken: string, name: string, parentId?: string): Promise<DriveFile> {
    const existing = await this.findFolder(accessToken, name, parentId)
    if (existing) return existing
    return this.createFolder(accessToken, name, parentId)
  }

  /** Idempotent find-or-create walking a full path, e.g. ["TaxDesk PK", "Clients", clientId]. */
  async ensureFolderPath(accessToken: string, segments: string[]): Promise<DriveFile> {
    let parent: DriveFile | undefined
    for (const segment of segments) {
      parent = await this.ensureFolder(accessToken, segment, parent?.id)
    }
    if (!parent) {
      throw new GoogleDriveApiError('ensureFolderPath called with no segments', 400)
    }
    return parent
  }

  async uploadFile(
    accessToken: string,
    input: { name: string; parentId: string; mimeType: string; body: Buffer },
  ): Promise<DriveFile> {
    const boundary = `taxdesk-${randomBytes(16).toString('hex')}`
    const metadata = JSON.stringify({ name: input.name, parents: [input.parentId] })
    const prefix = Buffer.from(
      `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${metadata}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${input.mimeType}\r\n\r\n`,
      'utf8',
    )
    const suffix = Buffer.from(`\r\n--${boundary}--`, 'utf8')
    const multipartBody = Buffer.concat([prefix, input.body, suffix])

    const res = await this.fetchFn(
      `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      },
    )
    const json = (await res.json()) as DriveFile & { error?: { message?: string } }
    if (!res.ok || !json.id) {
      throw new GoogleDriveApiError(json.error?.message ?? 'Drive upload failed', res.status, json)
    }
    return { id: json.id, name: json.name }
  }

  async downloadFile(accessToken: string, fileId: string): Promise<Buffer> {
    const res = await this.fetchFn(`${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new GoogleDriveApiError(`Drive download failed: ${text}`, res.status)
    }
    const buf = await res.arrayBuffer()
    return Buffer.from(buf)
  }

  async deleteFile(accessToken: string, fileId: string): Promise<void> {
    const res = await this.fetchFn(`${GOOGLE_DRIVE_FILES_URL}/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // Drive returns 204 on success; treat 404 as already-deleted (idempotent).
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '')
      throw new GoogleDriveApiError(`Drive delete failed: ${text}`, res.status)
    }
  }
}
