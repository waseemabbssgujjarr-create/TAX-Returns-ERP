import { createHmac, timingSafeEqual } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { ObjectStorageProvider, PutObjectInput } from './object-storage.interface'

/**
 * Local filesystem object storage for development/E2E when MinIO is unavailable.
 * Signed URLs are HMAC-scoped and expire; they hit GET /storage/object on the worker.
 */
@Injectable()
export class LocalFsStorageAdapter implements ObjectStorageProvider {
  private readonly root: string
  private readonly bucket: string
  private readonly signingSecret: string
  private readonly publicBaseUrl: string
  private readonly defaultSignedUrlExpiry: number

  constructor(private readonly config: ConfigService) {
    const storage = this.config.get('storage') as {
      bucket: string
      signedUrlExpiry: number
      localRoot?: string
    }
    const auth = this.config.get('auth') as { jwtAccessSecret: string }
    this.bucket = storage.bucket || 'taxdesk-documents'
    this.defaultSignedUrlExpiry = storage.signedUrlExpiry || 900
    this.root = path.resolve(
      storage.localRoot || process.env['LOCAL_STORAGE_ROOT'] || '.local-storage',
    )
    this.signingSecret = auth.jwtAccessSecret || 'local-storage-dev'
    this.publicBaseUrl = (
      process.env['WORKER_PUBLIC_URL'] ??
      process.env['NEXT_PUBLIC_API_URL'] ??
      'http://localhost:3001'
    ).replace(/\/$/, '')
  }

  private objectPath(key: string): string {
    const safe = key.replace(/\.\./g, '_').replace(/^[/\\]+/, '')
    return path.join(this.root, this.bucket, safe)
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const full = this.objectPath(input.key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, input.body)
  }

  async deleteObject(key: string): Promise<void> {
    const full = this.objectPath(key)
    await fs.unlink(full).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err
    })
  }

  async getObject(key: string): Promise<Buffer> {
    return fs.readFile(this.objectPath(key))
  }

  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const expiresIn = expiresInSeconds ?? this.defaultSignedUrlExpiry
    const exp = Math.floor(Date.now() / 1000) + expiresIn
    const sig = this.sign(key, exp)
    const params = new URLSearchParams({
      key,
      exp: String(exp),
      sig,
    })
    return Promise.resolve(`${this.publicBaseUrl}/storage/object?${params.toString()}`)
  }

  /** Validate a signed local download request. */
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

  openReadStream(key: string) {
    return createReadStream(this.objectPath(key))
  }

  private sign(key: string, exp: number): string {
    return createHmac('sha256', this.signingSecret).update(`${key}:${exp}`).digest('hex')
  }
}
