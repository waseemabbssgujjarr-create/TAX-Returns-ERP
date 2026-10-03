import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  decodeCiphertextBlobForTest,
  LOCAL_KMS_BLOB_VERSION,
  LocalKmsAdapter,
} from './local-kms.adapter'

function testMasterKey(): Buffer {
  return randomBytes(32)
}

describe('LocalKmsAdapter', () => {
  it('round-trips encrypt and decrypt with a data key', async () => {
    const kms = new LocalKmsAdapter(testMasterKey())
    const { plaintext: dataKey } = await kms.generateDataKey()
    const secret = Buffer.from('totp-secret-bytes', 'utf8')

    const ciphertext = await kms.encryptWithDataKey(dataKey, secret)
    const decrypted = await kms.decryptWithDataKey(dataKey, ciphertext)

    expect(decrypted.equals(secret)).toBe(true)
  })

  it('produces different ciphertext for the same plaintext (unique IVs)', async () => {
    const kms = new LocalKmsAdapter(testMasterKey())
    const dataKey = randomBytes(32)
    const plaintext = Buffer.from('same-input', 'utf8')

    const a = await kms.encryptWithDataKey(dataKey, plaintext)
    const b = await kms.encryptWithDataKey(dataKey, plaintext)

    expect(a).not.toBe(b)
    expect(await kms.decryptWithDataKey(dataKey, a)).toEqual(
      await kms.decryptWithDataKey(dataKey, b),
    )
  })

  it('throws when auth tag is tampered', async () => {
    const kms = new LocalKmsAdapter(testMasterKey())
    const dataKey = randomBytes(32)
    const encoded = await kms.encryptWithDataKey(dataKey, Buffer.from('payload'))

    const blob = Buffer.from(encoded, 'base64')
    const authTagOffset = 1 + 12
    blob[authTagOffset] = blob[authTagOffset]! ^ 0xff
    const tampered = blob.toString('base64')

    await expect(kms.decryptWithDataKey(dataKey, tampered)).rejects.toThrow()
  })

  it('stores version byte 0x01 and IC-4 layout (version | IV | authTag | ciphertext)', async () => {
    const kms = new LocalKmsAdapter(testMasterKey())
    const dataKey = randomBytes(32)
    const encoded = await kms.encryptWithDataKey(dataKey, Buffer.from('layout-check'))

    const parts = decodeCiphertextBlobForTest(encoded)
    expect(parts.version).toBe(LOCAL_KMS_BLOB_VERSION)
    expect(parts.iv.length).toBe(12)
    expect(parts.authTag.length).toBe(16)
    expect(parts.ciphertext.length).toBeGreaterThan(0)

    const raw = Buffer.from(encoded, 'base64')
    expect(raw[0]).toBe(0x01)
    expect(raw.length).toBe(1 + 12 + 16 + parts.ciphertext.length)
  })

  it('decrypts with the correct data key and fails with a wrong key', async () => {
    const kms = new LocalKmsAdapter(testMasterKey())
    const dataKey = randomBytes(32)
    const wrongKey = randomBytes(32)
    const encoded = await kms.encryptWithDataKey(dataKey, Buffer.from('rotation-check'))

    const plain = await kms.decryptWithDataKey(dataKey, encoded)
    expect(plain.toString('utf8')).toBe('rotation-check')

    await expect(kms.decryptWithDataKey(wrongKey, encoded)).rejects.toThrow()
  })

  it('wraps and unwraps data keys via the master key', async () => {
    const kms = new LocalKmsAdapter(testMasterKey())
    const { plaintext, wrapped } = await kms.generateDataKey()
    const unwrapped = await kms.unwrapDataKey(wrapped)
    expect(unwrapped.equals(plaintext)).toBe(true)
  })
})
