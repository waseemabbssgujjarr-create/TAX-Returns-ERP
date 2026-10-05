import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { AuditModule } from '../audit/audit.module'
import { KmsModule } from '../kms/kms.module'

import { GoogleDriveApiClient } from './google-drive-api.client'
import { GoogleDriveOAuthController } from './google-drive-oauth.controller'
import { GoogleDriveOAuthService } from './google-drive-oauth.service'
import { GoogleDriveStorageAdapter } from './google-drive-storage.adapter'

@Module({
  imports: [DatabaseModule, AuditModule, KmsModule],
  controllers: [GoogleDriveOAuthController],
  providers: [GoogleDriveApiClient, GoogleDriveOAuthService, GoogleDriveStorageAdapter],
  exports: [GoogleDriveApiClient, GoogleDriveOAuthService, GoogleDriveStorageAdapter],
})
export class GoogleDriveModule {}
