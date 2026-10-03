import { Inject, Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { KMS_TOKEN, type KeyManagementService } from '../kms/kms.interface'

@Injectable()
export class FirmDataKeyService {
  constructor(@Inject(KMS_TOKEN) private readonly kms: KeyManagementService) {}

  /** Ensures firm has a wrapped data key; returns plaintext key (caller must zero when done). */
  async getOrCreateDataKey(
    tx: Prisma.TransactionClient,
    firmId: string,
  ): Promise<{ dataKey: Buffer; wrappedKey: string }> {
    const firm = await tx.firm.findUnique({
      where: { id: firmId },
      select: { encryptedDataKey: true },
    })

    let wrappedKey = firm?.encryptedDataKey
    if (!wrappedKey) {
      const generated = await this.kms.generateDataKey()
      wrappedKey = generated.wrapped
      await tx.firm.update({
        where: { id: firmId },
        data: { encryptedDataKey: wrappedKey },
      })
      return { dataKey: generated.plaintext, wrappedKey }
    }

    const dataKey = await this.kms.unwrapDataKey(wrappedKey)
    return { dataKey, wrappedKey }
  }

  async unwrapExistingKey(tx: Prisma.TransactionClient, firmId: string): Promise<Buffer | null> {
    const firm = await tx.firm.findUnique({
      where: { id: firmId },
      select: { encryptedDataKey: true },
    })
    if (!firm?.encryptedDataKey) {
      return null
    }
    return this.kms.unwrapDataKey(firm.encryptedDataKey)
  }

  encryptField(dataKey: Buffer, plaintext: string): Promise<Buffer> {
    return this.kms.encryptWithDataKey(dataKey, Buffer.from(plaintext, 'utf8')).then((c) => {
      return Buffer.from(c, 'utf8')
    })
  }

  decryptField(dataKey: Buffer, encrypted: Buffer): Promise<string> {
    return this.kms
      .decryptWithDataKey(dataKey, encrypted.toString('utf8'))
      .then((buf) => buf.toString('utf8'))
  }
}
