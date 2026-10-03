import { InjectQueue } from '@nestjs/bull'
import { Injectable, Logger } from '@nestjs/common'
import type { Queue } from 'bullmq'

import { QUEUE_NAMES } from '../../queues/queue-names'

export interface AiExtractionJob {
  documentId: string
  firmId: string
  storageKey: string
  documentType: string
  taxYearFileId: string
}

@Injectable()
export class AiExtractionService {
  private readonly logger = new Logger(AiExtractionService.name)

  constructor(
    @InjectQueue(QUEUE_NAMES.AI_EXTRACTION)
    private readonly queue: Queue,
  ) {}

  /**
   * Enqueues an AI extraction job.
   * Called by DocumentProcessorConsumer after classification.
   * Uses documentId as idempotency key.
   */
  async enqueue(job: AiExtractionJob): Promise<void> {
    await this.queue.add('extract', job, {
      jobId: job.documentId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    })
    this.logger.log(`Enqueued AI extraction for document ${job.documentId}`)
  }
}
