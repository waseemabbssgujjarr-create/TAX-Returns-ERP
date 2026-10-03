import { randomUUID } from 'node:crypto'

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type {
  IrisFilingDto,
  RecordManualIrisReferenceBody,
  SubmitIrisFilingBody,
} from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import {
  IRIS_SUBMISSION_PORT,
  type IrisSubmissionPort,
} from '../../integrations/iris/iris-submission.port'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'

import { computeFilingReadiness, type FilingReadinessInput } from './filing-readiness.util'
import { resolveTaxYearFileForStaff } from './tax-year-access.util'

type IrisFilingRow = {
  id: string
  taxYearFileId: string
  status: string
  channel: string
  irisReferenceNo: string | null
  errorMessage: string | null
  attemptCount: number
  submittedAt: Date | null
  submittedById: string | null
  lastSyncedAt: Date | null
  updatedAt: Date
}

@Injectable()
export class IrisFilingService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
    @Inject(IRIS_SUBMISSION_PORT) private readonly irisPort: IrisSubmissionPort,
  ) {}

  /** Returns the current filing row + live readiness checklist, or null if never prepared. */
  async get(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    return this.prismaRls.withRlsContext(async (tx) => {
      const row = await tx.irisFiling.findUnique({ where: { taxYearFileId } })
      const readiness = await this.computeReadiness(tx, taxYearFileId)
      if (!row) return null
      return this.toDto(row, readiness)
    })
  }

  /** Creates/refreshes the filing row from current workspace readiness. Idempotent. */
  async prepare(user: AuthenticatedUser, taxYearFileId: string) {
    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)

    const { row, readiness } = await this.prismaRls.withRlsContext(async (tx) => {
      const existing = await tx.irisFiling.findUnique({ where: { taxYearFileId } })
      const readiness = await this.computeReadiness(tx, taxYearFileId)

      if (existing && ['SUBMITTED', 'ACCEPTED'].includes(existing.status)) {
        // Never downgrade a real/claimed submission by re-running prepare.
        return { row: existing, readiness }
      }

      const nextStatus = readiness.readyToFile ? 'READY' : 'DRAFT'
      const saved = await tx.irisFiling.upsert({
        where: { taxYearFileId },
        create: {
          id: randomUUID(),
          taxYearFileId,
          firmId: file.firmId,
          clientId: file.clientId,
          status: nextStatus,
        },
        update: { status: nextStatus },
      })
      return { row: saved, readiness }
    })

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'iris_filing.prepare',
      resourceType: 'iris_filing',
      resourceId: row.id,
      payload: { taxYearFileId, status: row.status, readyToFile: readiness.readyToFile },
    })

    return this.toDto(row, readiness)
  }

  /**
   * Attempts to submit to IRIS. Two paths:
   *  - Manual: staff already filed on the IRIS portal by hand and is recording
   *    the FBR acknowledgment/reference number here for tracking.
   *  - Adapter: delegates to IrisSubmissionPort. The stub always reports
   *    'not_configured', which we surface honestly as PENDING_INTEGRATION —
   *    never as a fake SUBMITTED state.
   */
  async submit(user: AuthenticatedUser, taxYearFileId: string, body: SubmitIrisFilingBody) {
    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    const row = await this.requireRow(taxYearFileId)

    if (row.status === 'SUBMITTED' || row.status === 'ACCEPTED') {
      const readiness = await this.prismaRls.withRlsContext((tx) =>
        this.computeReadiness(tx, taxYearFileId),
      )
      return this.toDto(row, readiness)
    }

    const readiness = await this.prismaRls.withRlsContext((tx) =>
      this.computeReadiness(tx, taxYearFileId),
    )
    if (!readiness.readyToFile) {
      throw new BadRequestException({
        title: 'Not ready to file',
        detail: 'Resolve blocking checklist items before submitting to IRIS.',
      })
    }

    const channel = body.channel ?? 'MANUAL_PORTAL'
    let update: Prisma.IrisFilingUpdateInput

    if (body.irisReferenceNo) {
      // Staff manually filed on the IRIS portal and is recording the result.
      update = {
        status: 'SUBMITTED',
        channel,
        irisReferenceNo: body.irisReferenceNo,
        errorMessage: null,
        submittedAt: new Date(),
        submittedById: user.userId,
        attemptCount: { increment: 1 },
      }
    } else {
      const result = await this.irisPort.submitReturn({
        firmId: file.firmId,
        clientId: file.clientId,
        taxYearFileId,
        taxYear: file.taxYear,
        payload: { note: 'Structured return draft reference only — see ReturnPreparation.' },
      })

      if (result.outcome === 'submitted') {
        update = {
          status: 'SUBMITTED',
          channel: 'API',
          irisReferenceNo: result.irisReferenceNo ?? null,
          responseJson: (result.raw ?? {}) as Prisma.InputJsonValue,
          errorMessage: null,
          submittedAt: new Date(),
          submittedById: user.userId,
          attemptCount: { increment: 1 },
        }
      } else {
        update = {
          status: 'PENDING_INTEGRATION',
          errorMessage:
            'No IRIS integration is configured yet. Export the prepared return and file it manually on the IRIS portal, then record the FBR reference number here.',
          attemptCount: { increment: 1 },
        }
      }
    }

    const saved = await this.prismaRls.withRlsContext((tx) =>
      tx.irisFiling.update({ where: { id: row.id }, data: update }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'iris_filing.submit_attempt',
      resourceType: 'iris_filing',
      resourceId: saved.id,
      payload: {
        taxYearFileId,
        outcome: body.irisReferenceNo ? 'manual_recorded' : saved.status.toLowerCase(),
        status: saved.status,
        channel: saved.channel,
      },
    })

    const freshReadiness = await this.prismaRls.withRlsContext((tx) =>
      this.computeReadiness(tx, taxYearFileId),
    )
    return this.toDto(saved, freshReadiness)
  }

  /** Polls IrisSubmissionPort.fetchStatus for a previously-submitted filing. */
  async refreshStatus(user: AuthenticatedUser, taxYearFileId: string) {
    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    const row = await this.requireRow(taxYearFileId)

    if (!row.irisReferenceNo || (row.status !== 'SUBMITTED' && row.status !== 'ACCEPTED')) {
      throw new BadRequestException({
        title: 'Nothing to sync',
        detail: 'Submit to IRIS (or record a reference number) before syncing status.',
      })
    }

    const result = await this.irisPort.fetchStatus({
      firmId: file.firmId,
      clientId: file.clientId,
      irisReferenceNo: row.irisReferenceNo,
    })

    const nextStatus =
      result.outcome === 'accepted'
        ? 'ACCEPTED'
        : result.outcome === 'rejected'
          ? 'REJECTED'
          : row.status

    const saved = await this.prismaRls.withRlsContext((tx) =>
      tx.irisFiling.update({
        where: { id: row.id },
        data: {
          status: nextStatus,
          lastSyncedAt: new Date(),
          ...(result.outcome === 'not_configured'
            ? {
                errorMessage:
                  'Status sync is not available — no live IRIS integration configured yet.',
              }
            : { errorMessage: null }),
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'iris_filing.status_sync',
      resourceType: 'iris_filing',
      resourceId: saved.id,
      payload: { taxYearFileId, outcome: result.outcome, status: saved.status },
    })

    const readiness = await this.prismaRls.withRlsContext((tx) =>
      this.computeReadiness(tx, taxYearFileId),
    )
    return this.toDto(saved, readiness)
  }

  async recordManualReference(
    user: AuthenticatedUser,
    taxYearFileId: string,
    body: RecordManualIrisReferenceBody,
  ) {
    return this.submit(user, taxYearFileId, {
      irisReferenceNo: body.irisReferenceNo,
      channel: 'MANUAL_PORTAL',
    })
  }

  async activity(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    const row = await this.prismaRls.withRlsContext((tx) =>
      tx.irisFiling.findUnique({ where: { taxYearFileId } }),
    )
    if (!row) return []

    return this.prismaRls.withRlsContext(async (tx) => {
      const logs = await tx.auditLog.findMany({
        where: { firmId: user.firmId, resourceType: 'iris_filing', resourceId: row.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, action: true, userId: true, createdAt: true, after: true },
      })
      return logs.map((l) => ({
        id: l.id,
        action: l.action,
        userId: l.userId,
        createdAt: l.createdAt.toISOString(),
        payload:
          l.after && typeof l.after === 'object' ? (l.after as Record<string, unknown>) : null,
      }))
    })
  }

  private async requireRow(taxYearFileId: string): Promise<IrisFilingRow> {
    const row = await this.prismaRls.withRlsContext((tx) =>
      tx.irisFiling.findUnique({ where: { taxYearFileId } }),
    )
    if (!row) {
      throw new NotFoundException({
        title: 'Filing not prepared',
        detail: 'Run prepare to compute readiness before submitting.',
      })
    }
    return row
  }

  private async computeReadiness(tx: Prisma.TransactionClient, taxYearFileId: string) {
    const [returnPrep, wealth, withholding, documentCount] = await Promise.all([
      tx.returnPreparation.findUnique({ where: { taxYearFileId } }),
      tx.wealthStatement.findUnique({ where: { taxYearFileId } }),
      tx.withholdingEntry.findMany({
        where: { taxYearFileId },
        select: { matched: true, validationStatus: true, cprReference: true, taxDeductedPaisa: true },
      }),
      tx.document.count({ where: { taxYearFileId } }),
    ])

    const returnPrepValidationStatus =
      returnPrep?.structuredJson &&
      typeof returnPrep.structuredJson === 'object' &&
      returnPrep.structuredJson !== null &&
      'validation' in returnPrep.structuredJson
        ? ((returnPrep.structuredJson as { validation?: { status?: string } }).validation?.status ??
          null)
        : null

    const input: FilingReadinessInput = {
      returnPrepReviewStatus: returnPrep?.reviewStatus ?? null,
      returnPrepValidationStatus,
      wealthStatus: wealth?.status ?? null,
      wealthReviewStatus: wealth?.reviewStatus ?? null,
      withholdingUnmatchedCount: withholding.filter((w) => !w.matched).length,
      // Mirrors withholding.service.ts's checklist() logic — IRIS blocks submission on
      // invalid rows or missing CPR for actually-withheld tax (F2 "CPR-before-submit" gate).
      withholdingInvalidCount: withholding.filter((w) => w.validationStatus.startsWith('INVALID_'))
        .length,
      withholdingMissingCprCount: withholding.filter(
        (w) => w.taxDeductedPaisa > 0n && !w.cprReference,
      ).length,
      documentCount,
    }

    return computeFilingReadiness(input)
  }

  private toDto(
    row: IrisFilingRow,
    readiness: ReturnType<typeof computeFilingReadiness>,
  ): IrisFilingDto {
    return {
      id: row.id,
      taxYearFileId: row.taxYearFileId,
      status: row.status as IrisFilingDto['status'],
      channel: row.channel as IrisFilingDto['channel'],
      irisReferenceNo: row.irisReferenceNo,
      errorMessage: row.errorMessage,
      attemptCount: row.attemptCount,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      submittedById: row.submittedById,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
      readiness,
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
