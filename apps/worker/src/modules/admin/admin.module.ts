import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { AuditModule } from '../audit/audit.module'

import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
