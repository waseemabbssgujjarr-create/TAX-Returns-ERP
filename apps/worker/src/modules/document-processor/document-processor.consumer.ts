import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'

import { QUEUE_NAMES } from '../../queues/queue-names'

import { DocumentProcessorPipelineService } from './document-processor.pipeline.service'
import type { DocumentProcessingJob } from './document-processor.service'

@Processor(QUEUE_NAMES.DOCUMENT_PROCESSING)
export class DocumentProcessorConsumer {
  private readonly logger = new Logger(DocumentProcessorConsumer.name)

  constructor(private readonly pipeline: DocumentProcessorPipelineService) {}

  @Process('process')
  async handleProcess(job: Job<DocumentProcessingJob>): Promise<void> {
    const { documentId, firmId, mimeType } = job.data

    this.logger.log(`Processing document ${documentId} (firm: ${firmId}, type: ${mimeType})`)

    await this.pipeline.run(job.data)

    this.logger.log(`Document ${documentId} pipeline complete`)
  }
}
