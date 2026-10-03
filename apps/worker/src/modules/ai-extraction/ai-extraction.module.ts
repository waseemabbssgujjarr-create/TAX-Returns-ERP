import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { QUEUE_NAMES } from '../../queues/queue-names'
import { StorageModule } from '../storage/storage.module'

import { OpenAiExtractionAdapter } from './adapters/openai-extraction.adapter'
import { AiExtractionHandlerService } from './ai-extraction-handler.service'
import { AiExtractionConsumer } from './ai-extraction.consumer'
import { AiExtractionService } from './ai-extraction.service'

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_EXTRACTION }),
  ],
  providers: [
    AiExtractionService,
    AiExtractionHandlerService,
    AiExtractionConsumer,
    {
      provide: 'AiExtractionProvider',
      useClass: OpenAiExtractionAdapter,
    },
  ],
  exports: [AiExtractionService, 'AiExtractionProvider'],
})
export class AiExtractionModule {}
