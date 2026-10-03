import { Module } from '@nestjs/common'

import { KMS_TOKEN } from './kms.interface'
import type { KeyManagementService } from './kms.interface'
import { decodeMasterKeyFromEnv, LocalKmsAdapter } from './local-kms.adapter'

@Module({
  providers: [
    {
      provide: KMS_TOKEN,
      useFactory: (): KeyManagementService => {
        const raw = process.env['ENCRYPTION_MASTER_KEY']
        if (!raw) {
          throw new Error('ENCRYPTION_MASTER_KEY is required for KMS')
        }
        const masterKey = decodeMasterKeyFromEnv(raw)
        return new LocalKmsAdapter(masterKey)
      },
    },
  ],
  exports: [KMS_TOKEN],
})
export class KmsModule {}
