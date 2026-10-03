import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import type { KeyManagementService } from './kms.interface'

/** IC-4: LocalKmsAdapter ciphertext version identifier */
export const LOCAL_KMS_BLOB_VERSION = 0x01

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const DATA_KEY_LENGTH = 32
const AES_ALGORITHM = 'aes-256-gcm'

function packCiphertextBlob(iv: Buffer, authTag: Buffer, ciphertext: Buffer): string {
  const blob = Buffer.concat([Buffer.from([LOCAL_KMS_BLOB_VERSION]), iv, authTag, ciphertext])
  return blob.toString('base64')
}

function unpackCiphertextBlob(encoded: string): {
  version: number
  iv: Buffer
  authTag: Buffer
  ciphertext: Buffer
} {
  const blob = Buffer.from(encoded, 'base64')
  const minLength = 1 + IV_LENGTH + AUTH_TAG_LENGTH
  if (blob.length < minLength) {
    throw new Error('Invalid ciphertext blob: too short')
  }

  const version = blob[0]!
  const iv = blob.subarray(1, 1 + IV_LENGTH)
  const authTag = blob.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = blob.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH)

  return { version, iv, authTag, ciphertext }
}

function aesGcmEncrypt(key: Buffer, plaintext: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(AES_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return packCiphertextBlob(iv, authTag, encrypted)
}

function aesGcmDecrypt(key: Buffer, encoded: string): Buffer {
  const { version, iv, authTag, ciphertext } = unpackCiphertextBlob(encoded)

  if (version !== LOCAL_KMS_BLOB_VERSION) {
    throw new Error(`Unsupported ciphertext version: 0x${version.toString(16).padStart(2, '0')}`)
  }

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function decodeMasterKeyFromEnv(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64')
  if (key.length !== DATA_KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must decode to exactly ${DATA_KEY_LENGTH} bytes (got ${key.length})`,
    )
  }
  return key
}

export class LocalKmsAdapter implements KeyManagementService {
  constructor(private readonly masterKey: Buffer) {
    if (masterKey.length !== DATA_KEY_LENGTH) {
      throw new Error(`Master key must be ${DATA_KEY_LENGTH} bytes`)
    }
  }

  generateDataKey(): Promise<{ plaintext: Buffer; wrapped: string }> {
    const plaintext = randomBytes(DATA_KEY_LENGTH)
    const wrapped = aesGcmEncrypt(this.masterKey, plaintext)
    return Promise.resolve({ plaintext, wrapped })
  }

  unwrapDataKey(wrapped: string): Promise<Buffer> {
    return Promise.resolve(aesGcmDecrypt(this.masterKey, wrapped))
  }

  encryptWithDataKey(dataKey: Buffer, plaintext: Buffer): Promise<string> {
    if (dataKey.length !== DATA_KEY_LENGTH) {
      return Promise.reject(new Error(`Data key must be ${DATA_KEY_LENGTH} bytes`))
    }
    return Promise.resolve(aesGcmEncrypt(dataKey, plaintext))
  }

  decryptWithDataKey(dataKey: Buffer, ciphertext: string): Promise<Buffer> {
    if (dataKey.length !== DATA_KEY_LENGTH) {
      return Promise.reject(new Error(`Data key must be ${DATA_KEY_LENGTH} bytes`))
    }
    return Promise.resolve(aesGcmDecrypt(dataKey, ciphertext))
  }
}

/** Exposed for unit tests that assert IC-4 blob layout */
export function decodeCiphertextBlobForTest(
  encoded: string,
): ReturnType<typeof unpackCiphertextBlob> {
  return unpackCiphertextBlob(encoded)
}
