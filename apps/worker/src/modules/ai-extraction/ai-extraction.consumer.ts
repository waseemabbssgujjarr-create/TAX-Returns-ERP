import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'

import { QUEUE_NAMES } from '../../queues/queue-names'

import { AiExtractionHandlerService } from './ai-extraction-handler.service'
import type { AiExtractionJob } from './ai-extraction.service'

@Processor(QUEUE_NAMES.AI_EXTRACTION)
export class AiExtractionConsumer {
  private readonly logger = new Logger(AiExtractionConsumer.name)

  constructor(private readonly handler: AiExtractionHandlerService) {}

  @Process('extract')
  async handleExtract(job: Job<AiExtractionJob>): Promise<void> {
    const { documentId, firmId, documentType } = job.data

    this.logger.log(`AI extraction start: doc=${documentId} firm=${firmId} type=${documentType}`)

    await this.handler.processJob(job.data)

    this.logger.log(`AI extraction complete: doc=${documentId}`)
  }
}
