/**
 * Key management abstraction for envelope encryption (TOTP, sensitive fields).
 * Production binds a managed-KMS adapter; dev uses LocalKmsAdapter.
 */
export interface KeyManagementService {
  /**
   * Generate a new random 256-bit data key.
   * Returns the raw key AND a wrapped (encrypted) version safe for DB storage.
   */
  generateDataKey(): Promise<{ plaintext: Buffer; wrapped: string }>

  /**
   * Decrypt a wrapped data key back to plaintext.
   * Only called transiently — plaintext must not be stored on the adapter.
   */
  unwrapDataKey(wrapped: string): Promise<Buffer>

  /**
   * Encrypt arbitrary plaintext bytes with a given data key.
   * Returns a base64-encoded ciphertext blob (version byte, IV, auth tag, ciphertext).
   */
  encryptWithDataKey(dataKey: Buffer, plaintext: Buffer): Promise<string>

  /**
   * Decrypt a ciphertext blob encrypted with a given data key.
   */
  decryptWithDataKey(dataKey: Buffer, ciphertext: string): Promise<Buffer>
}

export const KMS_TOKEN = 'KMS'
