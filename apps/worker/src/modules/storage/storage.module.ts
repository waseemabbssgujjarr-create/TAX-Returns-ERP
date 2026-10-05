import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { GoogleDriveStorageAdapter } from '../google-drive/google-drive-storage.adapter'
import { GoogleDriveModule } from '../google-drive/google-drive.module'

import { LocalFsStorageAdapter } from './local-fs-storage.adapter'
import { MinioStorageAdapter } from './minio-storage.adapter'
import { OBJECT_STORAGE_PROVIDER } from './object-storage.interface'
import { StorageController } from './storage.controller'

@Module({
  imports: [GoogleDriveModule],
  controllers: [StorageController],
  providers: [
    MinioStorageAdapter,
    LocalFsStorageAdapter,
    {
      provide: OBJECT_STORAGE_PROVIDER,
      inject: [ConfigService, MinioStorageAdapter, LocalFsStorageAdapter, GoogleDriveStorageAdapter],
      useFactory: (
        config: ConfigService,
        minio: MinioStorageAdapter,
        local: LocalFsStorageAdapter,
        googleDrive: GoogleDriveStorageAdapter,
      ) => {
        const driver = (
          process.env['STORAGE_DRIVER'] ??
          config.get<string>('storage.driver') ??
          's3'
        )
          .toString()
          .toLowerCase()

        const nodeEnv = process.env['NODE_ENV'] ?? 'development'
        if (nodeEnv === 'production' && driver === 'local') {
          // Spec: client documents must never be stored on local disk in production —
          // local storage is dev/E2E-only and is not durable/shared across app instances.
          throw new Error(
            'STORAGE_DRIVER=local is refused in production (NODE_ENV=production). ' +
              'Set STORAGE_DRIVER=google-drive and configure GOOGLE_OAUTH_* env vars.',
          )
        }

        if (driver === 'google-drive') return googleDrive
        if (driver === 'local') return local
        return minio
      },
    },
  ],
  exports: [OBJECT_STORAGE_PROVIDER],
})
export class StorageModule {}
