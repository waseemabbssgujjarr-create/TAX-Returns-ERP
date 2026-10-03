import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { LocalFsStorageAdapter } from './local-fs-storage.adapter'
import { MinioStorageAdapter } from './minio-storage.adapter'
import { OBJECT_STORAGE_PROVIDER } from './object-storage.interface'
import { StorageController } from './storage.controller'

@Module({
  controllers: [StorageController],
  providers: [
    MinioStorageAdapter,
    LocalFsStorageAdapter,
    {
      provide: OBJECT_STORAGE_PROVIDER,
      inject: [ConfigService, MinioStorageAdapter, LocalFsStorageAdapter],
      useFactory: (
        config: ConfigService,
        minio: MinioStorageAdapter,
        local: LocalFsStorageAdapter,
      ) => {
        const driver = (
          process.env['STORAGE_DRIVER'] ??
          config.get<string>('storage.driver') ??
          's3'
        )
          .toString()
          .toLowerCase()
        return driver === 'local' ? local : minio
      },
    },
  ],
  exports: [OBJECT_STORAGE_PROVIDER],
})
export class StorageModule {}
