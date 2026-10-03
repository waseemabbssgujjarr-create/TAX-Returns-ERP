import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'

import { QUEUE_NAMES } from '../../queues/queue-names'

import type { ExportJob } from './export-generator.service'
import { ExportGeneratorService } from './export-generator.service'

@Processor(QUEUE_NAMES.EXPORT)
export class ExportGeneratorConsumer {
  private readonly logger = new Logger(ExportGeneratorConsumer.name)

  constructor(private readonly exports: ExportGeneratorService) {}

  @Process('generate')
  async handleGenerate(job: Job<ExportJob>): Promise<void> {
    this.logger.log(
      `Generating ${job.data.exportType} artifact=${job.data.artifactId} firm=${job.data.firmId}`,
    )
    await this.exports.generateArtifact(job.data)
  }
}
