export const OBJECT_STORAGE_PROVIDER = Symbol('OBJECT_STORAGE_PROVIDER')

export interface PutObjectInput {
  key: string
  body: Buffer
  contentType: string
  contentLength: number
}

export interface ObjectStorageProvider {
  putObject(input: PutObjectInput): Promise<void>
  deleteObject(key: string): Promise<void>
  getObject(key: string): Promise<Buffer>
  getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>
}
