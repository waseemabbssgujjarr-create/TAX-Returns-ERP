import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type {
  ObjectStorageProvider,
  PutObjectInput,
  PutObjectResult,
} from './object-storage.interface'

@Injectable()
export class MinioStorageAdapter implements ObjectStorageProvider {
  private readonly logger = new Logger(MinioStorageAdapter.name)
  private readonly client: S3Client
  private readonly bucket: string
  private readonly defaultSignedUrlExpiry: number

  constructor(private readonly config: ConfigService) {
    const storage = this.config.get('storage') as {
      endpoint: string
      region: string
      bucket: string
      accessKeyId: string
      secretAccessKey: string
      signedUrlExpiry: number
    }

    this.bucket = storage.bucket
    this.defaultSignedUrlExpiry = storage.signedUrlExpiry

    this.client = new S3Client({
      region: storage.region,
      endpoint: storage.endpoint,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
      forcePathStyle: true,
    })
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        ServerSideEncryption: 'AES256',
      }),
    )
    this.logger.debug(`Stored object ${input.key}`)
    return {}
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    )
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    )
    const body = response.Body
    if (!body) {
      throw new Error(`Object not found: ${key}`)
    }
    const chunks: Uint8Array[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const expiresIn = expiresInSeconds ?? this.defaultSignedUrlExpiry
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })
    return getSignedUrl(this.client, command, { expiresIn })
  }
}
