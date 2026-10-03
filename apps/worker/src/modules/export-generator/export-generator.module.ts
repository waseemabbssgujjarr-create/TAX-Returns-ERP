import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { QUEUE_NAMES } from '../../queues/queue-names'
import { AuditModule } from '../audit/audit.module'
import { StorageModule } from '../storage/storage.module'

import { ExportGeneratorConsumer } from './export-generator.consumer'
import { ExportGeneratorService } from './export-generator.service'
import { ExportsController } from './exports.controller'
import { FILING_EXPORT_PROVIDER, StubFilingExportProvider } from './filing-export.provider'

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.EXPORT }),
    StorageModule,
    AuditModule,
  ],
  controllers: [ExportsController],
  providers: [
    ExportGeneratorService,
    ExportGeneratorConsumer,
    { provide: FILING_EXPORT_PROVIDER, useClass: StubFilingExportProvider },
  ],
  exports: [ExportGeneratorService, FILING_EXPORT_PROVIDER],
})
export class ExportGeneratorModule {}
