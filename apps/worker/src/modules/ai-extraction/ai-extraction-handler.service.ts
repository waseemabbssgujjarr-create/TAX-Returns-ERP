import { randomUUID } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import {
  DocumentExtractionStatus,
  DocumentProcessingStatus,
  DocumentReviewStatus,
  DocumentStatus,
} from '@prisma/client'
import { getExtractionSchemaBundle, resolveExtractionKind } from '@taxdesk/schemas'
import type { z } from 'zod'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { PRE_AUTH_USER_ID, withStaffBootstrapContext } from '../auth/rls-bootstrap.util'
import {
  OBJECT_STORAGE_PROVIDER,
  type ObjectStorageProvider,
} from '../storage/object-storage.interface'

import type { AiExtractionProvider } from './ai-extraction.provider'
import type { AiExtractionJob } from './ai-extraction.service'
import { zodSchemaToOpenAiJsonSchema } from './extraction-json-schema.util'
import { OpenAiExtractionError } from './openai.errors'

export interface ProvisionalExtractedFields {
  kind: string
  provisional: true
  awaitingReview: true
  payload: unknown
  validationIssues: Array<{ field: string; issue: string; severity: 'error' | 'warning' }>
  fieldConfidence: Record<string, number>
  overallConfidence: number
  extractedAt: string
}

@Injectable()
export class AiExtractionHandlerService {
  private readonly logger = new Logger(AiExtractionHandlerService.name)

  constructor(
    private readonly prismaRls: PrismaRlsClient,
    @Inject('AiExtractionProvider')
    private readonly aiProvider: AiExtractionProvider,
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly storage: ObjectStorageProvider,
  ) {}

  async processJob(job: AiExtractionJob, actorUserId?: string): Promise<void> {
    const userId = actorUserId ?? PRE_AUTH_USER_ID

    await withStaffBootstrapContext(job.firmId, userId, async () => {
      await this.prismaRls.withRlsContext(async (tx) => {
        const doc = await tx.document.findFirst({
          where: { id: job.documentId, firmId: job.firmId },
        })
        if (!doc) {
          this.logger.warn(`Document ${job.documentId} not found — skipping`)
          return
        }

        if (
          doc.extractionStatus === DocumentExtractionStatus.COMPLETE &&
          doc.status === DocumentStatus.EXTRACTED
        ) {
          this.logger.log(`Document ${job.documentId} already extracted — idempotent skip`)
          return
        }

        await tx.document.update({
          where: { id: doc.id },
          data: {
            status: DocumentStatus.PROCESSING,
            processingStatus: DocumentProcessingStatus.EXTRACTING,
            extractionStatus: DocumentExtractionStatus.IN_PROGRESS,
          },
        })

        try {
          const kind = resolveExtractionKind({
            documentType: job.documentType ?? doc.documentType,
            category: doc.category,
          })
          const bundle = getExtractionSchemaBundle(kind)

          if (!bundle) {
            await tx.document.update({
              where: { id: doc.id },
              data: {
                extractionStatus: DocumentExtractionStatus.SKIPPED,
                processingStatus: DocumentProcessingStatus.READY,
                status: DocumentStatus.UPLOADED,
              },
            })
            return
          }

          const jsonSchema = zodSchemaToOpenAiJsonSchema(
            bundle.zodSchema as z.ZodType,
            `${kind}_extraction`,
          )

          const raw = await this.aiProvider.extract({
            fileId: job.storageKey,
            documentType: kind,
            jsonSchema,
            firmId: job.firmId,
            documentId: job.documentId,
            mimeType: doc.mimeType,
            loadFileBytes: () => this.storage.getObject(job.storageKey),
          })

          const parsed = bundle.zodSchema.safeParse(raw.fields)
          if (!parsed.success) {
            throw new OpenAiExtractionError(
              `Extraction failed Zod validation: ${parsed.error.message}`,
            )
          }

          const validationIssues = bundle.validate(parsed.data)
          const hasBlockingError = validationIssues.some((i) => i.severity === 'error')
          if (hasBlockingError) {
            throw new OpenAiExtractionError(
              `Deterministic validation failed: ${validationIssues.map((i) => i.field).join(', ')}`,
            )
          }

          const provisional: ProvisionalExtractedFields = {
            kind,
            provisional: true,
            awaitingReview: true,
            payload: parsed.data,
            validationIssues,
            fieldConfidence: raw.fieldConfidence,
            overallConfidence: raw.overallConfidence,
            extractedAt: new Date().toISOString(),
          }

          await tx.document.update({
            where: { id: doc.id },
            data: {
              extractedFields: provisional as unknown as Prisma.InputJsonValue,
              confidence: raw.overallConfidence,
              documentType: kind,
              status: DocumentStatus.EXTRACTED,
              processingStatus: DocumentProcessingStatus.READY,
              extractionStatus: DocumentExtractionStatus.COMPLETE,
              reviewStatus: DocumentReviewStatus.IN_REVIEW,
            },
          })

          await tx.aiCallLog.create({
            data: {
              id: randomUUID(),
              firmId: job.firmId,
              documentId: job.documentId,
              model: raw.model ?? 'unknown',
              operation: 'extract',
              inputTokens: raw.usage?.inputTokens ?? 0,
              outputTokens: raw.usage?.outputTokens ?? 0,
              costPaisaEst: BigInt(raw.usage?.costPaisaEst ?? 0),
              status: 'success',
            },
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          this.logger.error(`AI extraction failed for ${job.documentId}: ${message}`)

          await tx.aiCallLog.create({
            data: {
              id: randomUUID(),
              firmId: job.firmId,
              documentId: job.documentId,
              model: 'n/a',
              operation: 'extract',
              inputTokens: 0,
              outputTokens: 0,
              costPaisaEst: 0n,
              status: 'failed',
              errorMessage: message.slice(0, 500),
            },
          })

          await tx.document.update({
            where: { id: doc.id },
            data: {
              status: DocumentStatus.FAILED,
              processingStatus: DocumentProcessingStatus.FAILED,
              extractionStatus: DocumentExtractionStatus.FAILED,
            },
          })

          throw err
        }
      })
    })
  }
}
