import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  DocumentCategory,
  DocumentExtractionStatus,
  DocumentProcessingStatus,
  DocumentStatus,
} from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { resolveExtractionKind } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AiExtractionProvider } from '../ai-extraction/ai-extraction.provider'
import { AiExtractionService } from '../ai-extraction/ai-extraction.service'
import { PRE_AUTH_USER_ID, withStaffBootstrapContext } from '../auth/rls-bootstrap.util'
import { validateUploadFile } from '../documents/file-magic.util'
import {
  OBJECT_STORAGE_PROVIDER,
  type ObjectStorageProvider,
} from '../storage/object-storage.interface'

import type { DocumentProcessingJob } from './document-processor.service'

function categoryForKind(kind: string): DocumentCategory {
  if (kind === 'SALARY_CERTIFICATE') return DocumentCategory.SALARY_CERTIFICATE
  if (kind === 'BANK_STATEMENT') return DocumentCategory.BANK_STATEMENT
  return DocumentCategory.UNCATEGORIZED
}

@Injectable()
export class DocumentProcessorPipelineService {
  private readonly logger = new Logger(DocumentProcessorPipelineService.name)

  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly aiExtraction: AiExtractionService,
    @Inject('AiExtractionProvider')
    private readonly aiProvider: AiExtractionProvider,
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly storage: ObjectStorageProvider,
  ) {}

  async run(job: DocumentProcessingJob, actorUserId?: string): Promise<void> {
    const userId = actorUserId ?? PRE_AUTH_USER_ID

    await withStaffBootstrapContext(job.firmId, userId, async () => {
      await this.prismaRls.withRlsContext(async (tx) => {
        const doc = await tx.document.findFirst({
          where: { id: job.documentId, firmId: job.firmId },
        })
        if (!doc) {
          this.logger.warn(`Document ${job.documentId} missing`)
          return
        }

        if (
          doc.extractionStatus === DocumentExtractionStatus.COMPLETE ||
          doc.processingStatus === DocumentProcessingStatus.EXTRACTING ||
          doc.processingStatus === DocumentProcessingStatus.READY
        ) {
          this.logger.log(`Document ${job.documentId} already processed — idempotent skip`)
          return
        }

        await tx.document.update({
          where: { id: doc.id },
          data: {
            status: DocumentStatus.PROCESSING,
            processingStatus: DocumentProcessingStatus.SECURITY_CHECK,
          },
        })

        const buffer = await this.storage.getObject(job.storageKey)
        const validation = validateUploadFile(buffer, job.mimeType, doc.sizeBytes)
        if (!validation.ok) {
          await this.markFailed(tx, doc.id)
          throw new Error(validation.reason)
        }

        await tx.document.update({
          where: { id: doc.id },
          data: { processingStatus: DocumentProcessingStatus.CLASSIFYING },
        })

        let documentType = doc.documentType
        let category = doc.category

        if (category === DocumentCategory.UNCATEGORIZED || !documentType) {
          const classified = await this.aiProvider.classify({
            fileId: job.storageKey,
            mimeType: validation.mime,
            firmId: job.firmId,
            loadFileBytes: () => Promise.resolve(buffer),
          })
          const kind = resolveExtractionKind({ documentType: classified.documentType })
          documentType = kind !== 'UNKNOWN' ? kind : classified.documentType
          if (category === DocumentCategory.UNCATEGORIZED && kind !== 'UNKNOWN') {
            category = categoryForKind(kind)
          }
        }

        await tx.document.update({
          where: { id: doc.id },
          data: {
            documentType,
            category,
            processingStatus: DocumentProcessingStatus.EXTRACTING,
          },
        })

        await this.aiExtraction.enqueue({
          documentId: job.documentId,
          firmId: job.firmId,
          storageKey: job.storageKey,
          documentType: documentType ?? 'UNKNOWN',
          taxYearFileId: job.taxYearFileId,
        })
      })
    })
  }

  private async markFailed(tx: Prisma.TransactionClient, documentId: string): Promise<void> {
    await tx.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.FAILED,
        processingStatus: DocumentProcessingStatus.FAILED,
      },
    })
  }
}
