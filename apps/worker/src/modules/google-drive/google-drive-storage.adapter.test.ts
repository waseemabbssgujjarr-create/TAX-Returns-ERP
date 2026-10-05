import { UnprocessableEntityException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'

import type { GoogleDriveApiClient } from './google-drive-api.client'
import type { GoogleDriveAccessContext, GoogleDriveOAuthService } from './google-drive-oauth.service'
import { GoogleDriveStorageAdapter } from './google-drive-storage.adapter'

function makeConfig(): ConfigService {
  const values: Record<string, unknown> = {
    storage: { signedUrlExpiry: 900 },
    auth: { jwtAccessSecret: 'test-secret' },
  }
  return { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService
}

describe('GoogleDriveStorageAdapter', () => {
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let oauth: {
    resolveStorageOwner: ReturnType<typeof vi.fn>
    getAccessContext: ReturnType<typeof vi.fn>
  }
  let apiClient: Pick<GoogleDriveApiClient, 'ensureFolder' | 'uploadFile' | 'downloadFile' | 'deleteFile'>
  let adapter: GoogleDriveStorageAdapter

  beforeEach(() => {
    withRlsContextMock = vi.fn()
    oauth = {
      resolveStorageOwner: vi.fn().mockResolvedValue('user-1'),
      getAccessContext: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        rootFolderId: 'root-folder',
        ownerUserId: 'user-1',
      } satisfies GoogleDriveAccessContext),
    }
    apiClient = {
      ensureFolder: vi.fn().mockResolvedValue({ id: 'year-folder', name: '2025' }),
      uploadFile: vi.fn().mockResolvedValue({ id: 'drive-file-1', name: 'cert.pdf' }),
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('file-bytes')),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    }

    adapter = new GoogleDriveStorageAdapter(
      { withRlsContext: withRlsContextMock } as unknown as PrismaRlsClient,
      oauth as unknown as GoogleDriveOAuthService,
      apiClient as unknown as GoogleDriveApiClient,
      makeConfig(),
    )
  })

  it('uploads under TaxDesk PK/Clients/<clientId>/<taxYear> and records the drive mapping', async () => {
    const upsert = vi.fn().mockResolvedValue({})
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ googleDriveObject: { upsert } }),
    )

    const result = await adapter.putObject({
      key: 'firms/firm-1/documents/doc-1/cert.pdf',
      body: Buffer.from('bytes'),
      contentType: 'application/pdf',
      contentLength: 5,
      firmId: 'firm-1',
      storageOwnerUserId: 'user-1',
      clientId: 'client-1',
      taxYear: 2025,
    })

    expect(oauth.resolveStorageOwner).toHaveBeenCalledWith('firm-1', 'user-1')
    expect(apiClient.ensureFolder).toHaveBeenCalledWith('access-token', 'client-1', 'root-folder')
    expect(apiClient.ensureFolder).toHaveBeenCalledWith('access-token', '2025', 'year-folder')
    expect(result.providerFileId).toBe('drive-file-1')
    expect(result.resolvedOwnerUserId).toBe('user-1')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'firms/firm-1/documents/doc-1/cert.pdf' } }),
    )
  })

  it('rejects a putObject call with no firmId (defence in depth)', async () => {
    await expect(
      adapter.putObject({
        key: 'any-key',
        body: Buffer.from('x'),
        contentType: 'application/pdf',
        contentLength: 1,
        firmId: '',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)
  })

  it('deleteObject is idempotent when the mapping no longer exists', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ googleDriveObject: { findUnique: vi.fn().mockResolvedValue(null) } }),
    )

    await expect(
      adapter.deleteObject('firms/firm-1/documents/doc-1/cert.pdf'),
    ).resolves.toBeUndefined()
    expect(apiClient.deleteFile).not.toHaveBeenCalled()
  })

  it('getSignedDownloadUrl never returns a public drive.google.com link', async () => {
    const url = await adapter.getSignedDownloadUrl('firms/firm-1/documents/doc-1/cert.pdf', 900)

    expect(url).not.toContain('drive.google.com')
    expect(url).toContain('/storage/drive-object')

    const parsed = new URL(url)
    const key = parsed.searchParams.get('key')!
    const exp = Number(parsed.searchParams.get('exp'))
    const sig = parsed.searchParams.get('sig')!
    expect(adapter.verifySignedRequest(key, exp, sig)).toBe(true)
    // Tampered signature must fail.
    expect(adapter.verifySignedRequest(key, exp, `${sig}00`)).toBe(false)
  })

  it('getObject rejects an unknown storage key (no drive mapping)', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        googleDriveObject: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      }),
    )

    await expect(adapter.getObject('firms/firm-1/documents/doc-99/missing.pdf')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    )
    expect(oauth.getAccessContext).not.toHaveBeenCalled()
    expect(apiClient.downloadFile).not.toHaveBeenCalled()
  })

  it('resolveStorageOwner never uses a connection outside the requested firm', async () => {
    oauth.resolveStorageOwner.mockRejectedValue(
      new UnprocessableEntityException({ title: 'Google Drive not connected' }),
    )

    await expect(
      adapter.putObject({
        key: 'firms/firm-2/documents/doc-1/cert.pdf',
        body: Buffer.from('bytes'),
        contentType: 'application/pdf',
        contentLength: 5,
        firmId: 'firm-2',
        storageOwnerUserId: 'user-other-firm',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)

    expect(oauth.resolveStorageOwner).toHaveBeenCalledWith('firm-2', 'user-other-firm')
    expect(apiClient.uploadFile).not.toHaveBeenCalled()
  })

  it('getObject uses the mapped owner — never a different user\'s connection', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        googleDriveObject: {
          findUnique: vi.fn().mockResolvedValue({
            key: 'firms/firm-1/documents/doc-1/cert.pdf',
            firmId: 'firm-1',
            driveFileId: 'drive-file-1',
            ownerUserId: 'owner-of-record',
          }),
        },
      }),
    )

    await adapter.getObject('firms/firm-1/documents/doc-1/cert.pdf')

    expect(oauth.getAccessContext).toHaveBeenCalledWith('firm-1', 'owner-of-record')
  })
})
