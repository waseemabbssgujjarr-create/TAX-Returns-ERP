import { InjectQueue } from '@nestjs/bull'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'

import { QUEUE_NAMES } from '../../queues/queue-names'

export interface DocumentProcessingJob {
  documentId: string
  firmId: string
  storageKey: string
  mimeType: string
  taxYearFileId: string
}

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name)

  constructor(
    @InjectQueue(QUEUE_NAMES.DOCUMENT_PROCESSING)
    private readonly queue: Queue,
  ) {}

  /**
   * Enqueues a document for processing.
   * Uses documentId as idempotency key to prevent duplicate processing.
   */
  async enqueue(job: DocumentProcessingJob): Promise<void> {
    await this.queue.add('process', job, {
      jobId: job.documentId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })
    this.logger.log(`Enqueued document ${job.documentId} for processing`)
  }
}
