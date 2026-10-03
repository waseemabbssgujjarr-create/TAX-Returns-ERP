import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { AuditModule } from '../audit/audit.module'
import { DocumentProcessorModule } from '../document-processor/document-processor.module'
import { StorageModule } from '../storage/storage.module'

import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'

@Module({
  imports: [DatabaseModule, AuditModule, StorageModule, DocumentProcessorModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
