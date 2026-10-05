import { createHmac, timingSafeEqual } from 'node:crypto'

import { Injectable, UnprocessableEntityException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import type {
  ObjectStorageProvider,
  PutObjectInput,
  PutObjectResult,
} from '../storage/object-storage.interface'

import { GoogleDriveApiClient } from './google-drive-api.client'
import { GoogleDriveOAuthService } from './google-drive-oauth.service'

/**
 * Google Drive-backed ObjectStorageProvider — files physically live in the
 * owning staff user's own Drive, under "TaxDesk PK/Clients/<clientId>/<taxYear>".
 * Never returns a public/shareable Drive link: getSignedDownloadUrl() always
 * points back at this worker's own HMAC-signed proxy endpoint, which streams
 * bytes server-side using the owner's refreshed OAuth access token.
 */
@Injectable()
export class GoogleDriveStorageAdapter implements ObjectStorageProvider {
  private readonly signingSecret: string
  private readonly defaultSignedUrlExpiry: number
  private readonly publicBaseUrl: string

  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly oauth: GoogleDriveOAuthService,
    private readonly apiClient: GoogleDriveApiClient,
    private readonly config: ConfigService,
  ) {
    const storage = this.config.get('storage') as { signedUrlExpiry: number }
    const auth = this.config.get('auth') as { jwtAccessSecret: string }
    this.defaultSignedUrlExpiry = storage.signedUrlExpiry || 900
    this.signingSecret = auth.jwtAccessSecret || 'google-drive-dev'
    this.publicBaseUrl = (
      process.env['WORKER_PUBLIC_URL'] ??
      process.env['NEXT_PUBLIC_API_URL'] ??
      'http://localhost:3001'
    ).replace(/\/$/, '')
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    if (!input.firmId) {
      throw new UnprocessableEntityException({ title: 'firmId is required for Google Drive storage' })
    }
    const firmId = input.firmId
    const ownerUserId = await this.oauth.resolveStorageOwner(firmId, input.storageOwnerUserId)
    const access = await this.oauth.getAccessContext(firmId, ownerUserId)

    // Walk "<rootFolderId>/<clientId>/<taxYear>" by name, creating as needed.
    const clientFolder = input.clientId
      ? await this.apiClient.ensureFolder(access.accessToken, input.clientId, access.rootFolderId)
      : { id: access.rootFolderId, name: 'root' }
    const yearFolder =
      input.taxYear !== undefined
        ? await this.apiClient.ensureFolder(access.accessToken, String(input.taxYear), clientFolder.id)
        : clientFolder

    const uploaded = await this.apiClient.uploadFile(access.accessToken, {
      name: input.key.split('/').pop() ?? input.key,
      parentId: yearFolder.id,
      mimeType: input.contentType,
      body: input.body,
    })

    await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveObject.upsert({
        where: { key: input.key },
        create: {
          firmId,
          key: input.key,
          driveFileId: uploaded.id,
          driveFolderId: yearFolder.id,
          ownerUserId,
        },
        update: {
          driveFileId: uploaded.id,
          driveFolderId: yearFolder.id,
          ownerUserId,
        },
      }),
    )

    return {
      providerFileId: uploaded.id,
      providerFolderId: yearFolder.id,
      resolvedOwnerUserId: ownerUserId,
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const { access, record } = await this.resolveObject(key)
    return this.apiClient.downloadFile(access.accessToken, record.driveFileId)
  }

  async deleteObject(key: string): Promise<void> {
    const record = await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveObject.findUnique({ where: { key } }),
    )
    if (!record) return // idempotent — nothing to delete

    const access = await this.oauth.getAccessContext(record.firmId, record.ownerUserId)
    await this.apiClient.deleteFile(access.accessToken, record.driveFileId)
    await this.prismaRls.withRlsContext((tx) => tx.googleDriveObject.delete({ where: { key } }))
  }

  /** Never a public Drive link — always our own signed proxy endpoint. */
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const expiresIn = expiresInSeconds ?? this.defaultSignedUrlExpiry
    const exp = Math.floor(Date.now() / 1000) + expiresIn
    const sig = this.sign(key, exp)
    const params = new URLSearchParams({ key, exp: String(exp), sig })
    return Promise.resolve(`${this.publicBaseUrl}/storage/drive-object?${params.toString()}`)
  }

  /** Validate a signed proxy-download request (mirrors LocalFsStorageAdapter). */
  verifySignedRequest(key: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false
    const expected = this.sign(key, exp)
    try {
      const a = Buffer.from(expected)
      const b = Buffer.from(sig)
      return a.length === b.length && timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  private async resolveObject(key: string) {
    const record = await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveObject.findUnique({ where: { key } }),
    )
    if (!record) {
      throw new UnprocessableEntityException({ title: 'Object not found', detail: key })
    }
    const access = await this.oauth.getAccessContext(record.firmId, record.ownerUserId)
    return { access, record }
  }

  private sign(key: string, exp: number): string {
    return createHmac('sha256', this.signingSecret).update(`${key}:${exp}`).digest('hex')
  }
}
