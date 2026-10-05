import { randomUUID } from 'node:crypto'

import { InjectQueue } from '@nestjs/bull'
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { CreateExportBody } from '@taxdesk/schemas'
import type { Queue } from 'bullmq'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { QUEUE_NAMES } from '../../queues/queue-names'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'
import { withStaffBootstrapContext } from '../auth/rls-bootstrap.util'
import {
  OBJECT_STORAGE_PROVIDER,
  type ObjectStorageProvider,
} from '../storage/object-storage.interface'
import { resolveTaxYearFileForStaff } from '../tax-years/tax-year-access.util'

import { buildReportLines } from './report-lines.util'
import { buildSimplePdf } from './simple-pdf.util'

export type ExportType =
  | 'TAX_SUMMARY_PDF'
  | 'RETURN_WORKSHEET'
  | 'WEALTH_STATEMENT'
  | 'AUDIT_LOG_CSV'

export interface ExportJob {
  exportType: ExportType
  firmId: string
  clientId?: string
  taxYearFileId?: string
  requestedByUserId: string
  locale: 'en' | 'ur'
  artifactId: string
}

@Injectable()
export class ExportGeneratorService {
  private readonly logger = new Logger(ExportGeneratorService.name)

  constructor(
    @InjectQueue(QUEUE_NAMES.EXPORT)
    private readonly queue: Queue,
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly storage: ObjectStorageProvider,
  ) {}

  async requestExport(user: AuthenticatedUser, body: CreateExportBody) {
    if (user.sessionType !== 'staff' || user.sessionState !== 'full') {
      throw new BadRequestException({ title: 'Staff session required' })
    }
    if (body.exportType === 'AUDIT_LOG_CSV') {
      throw new BadRequestException({
        title: 'Audit log CSV export is not enabled on tax-year exports',
      })
    }

    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, body.taxYearFileId)
    const artifactId = randomUUID()

    const created = await this.prismaRls.withRlsContext(async (tx) =>
      tx.exportArtifact.create({
        data: {
          id: artifactId,
          firmId: file.firmId,
          clientId: file.clientId,
          taxYearFileId: file.id,
          exportType: body.exportType,
          status: 'PENDING',
          locale: body.locale,
          requestedById: user.userId,
        },
      }),
    )

    const jobId = await this.enqueue({
      exportType: body.exportType,
      firmId: file.firmId,
      clientId: file.clientId,
      taxYearFileId: file.id,
      requestedByUserId: user.userId,
      locale: body.locale,
      artifactId,
    })

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'export.request',
      resourceType: 'export_artifact',
      resourceId: artifactId,
      payload: { exportType: body.exportType, taxYearFileId: file.id, jobId },
    })

    return this.toDto(created)
  }

  async enqueue(job: ExportJob): Promise<string> {
    const jobId = `export:${job.artifactId}`
    await this.queue.add('generate', job, {
      jobId,
      attempts: 2,
    })
    this.logger.log(`Enqueued export ${jobId} type=${job.exportType}`)
    return jobId
  }

  async getArtifact(user: AuthenticatedUser, artifactId: string) {
    const row = await this.prismaRls.withRlsContext(async (tx) =>
      tx.exportArtifact.findFirst({
        where: { id: artifactId, firmId: user.firmId },
      }),
    )
    if (!row) throw new NotFoundException({ title: 'Export not found' })
    return this.toDto(row)
  }

  async getDownloadUrl(user: AuthenticatedUser, artifactId: string) {
    const row = await this.prismaRls.withRlsContext(async (tx) =>
      tx.exportArtifact.findFirst({
        where: { id: artifactId, firmId: user.firmId },
      }),
    )
    if (!row) throw new NotFoundException({ title: 'Export not found' })
    if (row.status !== 'READY' || !row.storageKey) {
      throw new BadRequestException({ title: 'Export is not ready for download' })
    }

    const expiresInSeconds = 900
    const url = await this.storage.getSignedDownloadUrl(row.storageKey, expiresInSeconds)

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'export.download',
      resourceType: 'export_artifact',
      resourceId: artifactId,
      payload: { exportType: row.exportType },
    })

    return {
      url,
      expiresInSeconds,
      artifact: this.toDto(row),
    }
  }

  /** Used by the queue consumer (and tests) under an explicit RLS identity. */
  async generateArtifact(job: ExportJob): Promise<void> {
    await withStaffBootstrapContext(job.firmId, job.requestedByUserId, async () => {
      try {
        const payload = await this.prismaRls.withRlsContext(async (tx) => {
          if (!job.taxYearFileId) {
            throw new Error('taxYearFileId required')
          }
          const file = await tx.taxYearFile.findFirst({
            where: { id: job.taxYearFileId, client: { firmId: job.firmId } },
            include: {
              client: { select: { id: true, displayName: true, firm: { select: { name: true } } } },
              wealthStatement: true,
              withholdingEntries: true,
              returnPreparation: true,
              computationSnapshots: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
          })
          if (!file) throw new Error('Tax year not found for export')
          return file
        })

        const snapshot = payload.computationSnapshots[0] ?? null
        const rulesVersion = snapshot?.rulesVersion ?? payload.rulesVersion
        const rulesState = /draft|placeholder/i.test(rulesVersion ?? '')
          ? 'DRAFT'
          : snapshot?.status === 'RULES_UNAVAILABLE'
            ? 'UNAVAILABLE'
            : snapshot?.status === 'SUCCESS'
              ? 'AVAILABLE'
              : 'UNKNOWN'

        const matched = payload.withholdingEntries.filter((w) => w.matched).length
        let taxPayablePaisa: string | null = null
        if (snapshot?.resultJson && typeof snapshot.resultJson === 'object') {
          const rj = snapshot.resultJson as Record<string, unknown>
          for (const key of ['taxPayablePaisa', 'netTaxPaisa', 'taxPayable']) {
            const v = rj[key]
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
              taxPayablePaisa = String(v)
              break
            }
          }
        }

        let returnPrepValidationStatus: string | null = null
        let sectionComplete: number | undefined
        let sectionTotal: number | undefined
        const prepJson = payload.returnPreparation?.structuredJson
        if (prepJson && typeof prepJson === 'object') {
          const pj = prepJson as Record<string, unknown>
          const validation = pj.validation as { status?: string } | undefined
          returnPrepValidationStatus = validation?.status ?? null
          const completeness = pj.sectionCompleteness as
            | { complete?: number; total?: number }
            | undefined
          sectionComplete = completeness?.complete
          sectionTotal = completeness?.total
        }

        let withholdingTaxDeducted = 0n
        for (const w of payload.withholdingEntries) {
          try {
            withholdingTaxDeducted += w.taxDeductedPaisa
          } catch {
            // ignore
          }
        }

        const lines = buildReportLines({
          exportType: job.exportType,
          locale: job.locale,
          firmName: payload.client.firm.name,
          clientName: payload.client.displayName,
          taxYear: payload.taxYear,
          rulesVersion,
          rulesState,
          wealthStatus: payload.wealthStatement?.status ?? null,
          wealthDiscrepancyPaisa: payload.wealthStatement?.discrepancy?.toString() ?? null,
          withholdingMatched: matched,
          withholdingTotal: payload.withholdingEntries.length,
          withholdingTaxDeductedPaisa: withholdingTaxDeducted.toString(),
          computationStatus: snapshot?.status ?? null,
          taxPayablePaisa,
          returnPrepReview: payload.returnPreparation?.reviewStatus ?? null,
          returnPrepValidationStatus,
          ...(sectionComplete !== undefined ? { sectionComplete } : {}),
          ...(sectionTotal !== undefined ? { sectionTotal } : {}),
          draftBanner: rulesState !== 'AVAILABLE',
        })

        let body: Buffer
        let mimeType: string
        if (job.exportType === 'AUDIT_LOG_CSV') {
          body = Buffer.from(lines.join('\n'), 'utf8')
          mimeType = 'text/csv'
        } else {
          body = buildSimplePdf(lines)
          mimeType = 'application/pdf'
        }

        const storageKey = `${job.firmId}/exports/${job.artifactId}.${mimeType === 'text/csv' ? 'csv' : 'pdf'}`
        await this.storage.putObject({
          key: storageKey,
          body,
          contentType: mimeType,
          contentLength: body.length,
          firmId: job.firmId,
        })

        await this.prismaRls.withRlsContext(async (tx) =>
          tx.exportArtifact.update({
            where: { id: job.artifactId },
            data: {
              status: 'READY',
              storageKey,
              mimeType,
              rulesVersion,
              rulesState,
              completedAt: new Date(),
              errorMessage: null,
            },
          }),
        )

        await this.audit.log({
          firmId: job.firmId,
          userId: job.requestedByUserId,
          action: 'export.ready',
          resourceType: 'export_artifact',
          resourceId: job.artifactId,
          payload: {
            exportType: job.exportType,
            rulesState,
            rulesVersion: rulesVersion ?? null,
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed'
        this.logger.error(`Export ${job.artifactId} failed: ${message}`)
        await this.prismaRls.withRlsContext(async (tx) =>
          tx.exportArtifact.update({
            where: { id: job.artifactId },
            data: {
              status: 'FAILED',
              errorMessage: message.slice(0, 500),
              completedAt: new Date(),
            },
          }),
        )
        await this.audit.log({
          firmId: job.firmId,
          userId: job.requestedByUserId,
          action: 'export.failed',
          resourceType: 'export_artifact',
          resourceId: job.artifactId,
          payload: { exportType: job.exportType, error: message.slice(0, 200) },
        })
        throw err
      }
    })
  }

  private toDto(row: {
    id: string
    firmId: string
    clientId: string | null
    taxYearFileId: string | null
    exportType: string
    status: string
    mimeType: string | null
    locale: string
    rulesVersion: string | null
    rulesState: string | null
    errorMessage: string | null
    createdAt: Date
    completedAt: Date | null
  }) {
    return {
      id: row.id,
      firmId: row.firmId,
      clientId: row.clientId,
      taxYearFileId: row.taxYearFileId,
      exportType: row.exportType,
      status: row.status,
      mimeType: row.mimeType,
      locale: row.locale === 'ur' ? 'ur' : 'en',
      rulesVersion: row.rulesVersion,
      rulesState: row.rulesState,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    }
  }
}
