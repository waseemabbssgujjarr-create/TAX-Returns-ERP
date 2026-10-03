import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { QUEUE_NAMES } from '../../queues/queue-names'
import { AiExtractionModule } from '../ai-extraction/ai-extraction.module'
import { StorageModule } from '../storage/storage.module'

import { DocumentProcessorConsumer } from './document-processor.consumer'
import { DocumentProcessorPipelineService } from './document-processor.pipeline.service'
import { DocumentProcessorService } from './document-processor.service'

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AiExtractionModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.DOCUMENT_PROCESSING }),
  ],
  providers: [
    DocumentProcessorService,
    DocumentProcessorPipelineService,
    DocumentProcessorConsumer,
  ],
  exports: [DocumentProcessorService],
})
export class DocumentProcessorModule {}
