import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { AuditModule } from '../audit/audit.module'

import { ComplianceController } from './compliance.controller'
import { ComplianceService } from './compliance.service'

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
