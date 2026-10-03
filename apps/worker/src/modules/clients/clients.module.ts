import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { AuditModule } from '../audit/audit.module'
import { KmsModule } from '../kms/kms.module'

import { ClientsController } from './clients.controller'
import { ClientsService } from './clients.service'
import { FirmDataKeyService } from './firm-data-key.service'

@Module({
  imports: [DatabaseModule, AuditModule, KmsModule],
  controllers: [ClientsController],
  providers: [ClientsService, FirmDataKeyService],
})
export class ClientsModule {}
