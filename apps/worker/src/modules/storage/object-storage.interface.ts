export const OBJECT_STORAGE_PROVIDER = Symbol('OBJECT_STORAGE_PROVIDER')

export interface PutObjectInput {
  key: string
  body: Buffer
  contentType: string
  contentLength: number
  /** Owning firm — required so the Google Drive driver can resolve a connection. Ignored by Local/Minio. */
  firmId: string
  /**
   * Google Drive driver only — the staff user whose connected Drive should
   * own this object. If omitted (e.g. portal client uploads), the adapter
   * falls back to the firm's default connection. Ignored by Local/Minio.
   */
  storageOwnerUserId?: string
  /** Google Drive driver only — folder path segment: Clients/<clientId>. */
  clientId?: string
  /** Google Drive driver only — folder path segment: .../<taxYear>. */
  taxYear?: number
}

export interface PutObjectResult {
  /** Provider-specific file id (e.g. Drive fileId). Undefined for Local/Minio. */
  providerFileId?: string
  /** Provider-specific parent folder id. Undefined for Local/Minio. */
  providerFolderId?: string
  /** The user id actually used as storage owner (after fallback resolution). */
  resolvedOwnerUserId?: string
}

export interface ObjectStorageProvider {
  putObject(input: PutObjectInput): Promise<PutObjectResult>
  deleteObject(key: string): Promise<void>
  getObject(key: string): Promise<Buffer>
  getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>
}
