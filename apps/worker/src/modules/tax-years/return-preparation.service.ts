import { randomUUID } from 'node:crypto'

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import {
  ReturnPrepDraftV1Schema,
  type ApproveReturnPrepBody,
  type DemoteReturnPrepBody,
  type UpsertReturnPreparationBody,
} from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'

import { assembleReturnDraft } from './assemble-return-draft.util'
import { resolveTaxYearFileForStaff } from './tax-year-access.util'

const APPROVER_ROLES: UserRole[] = [UserRole.OWNER, UserRole.MANAGER, UserRole.REVIEWER]

@Injectable()
export class ReturnPreparationService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
  ) {}

  async get(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    return this.prismaRls.withRlsContext(async (tx) => {
      const row = await tx.returnPreparation.findUnique({ where: { taxYearFileId } })
      if (!row) return null
      return this.toDto(row)
    })
  }

  /** Notes-only upsert while DRAFT/IN_REVIEW. Never sets APPROVED. Never overwrites verified assemble payload arbitrarily. */
  async upsert(user: AuthenticatedUser, taxYearFileId: string, body: UpsertReturnPreparationBody) {
    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)

    const existing = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.findUnique({ where: { taxYearFileId } }),
    )

    if (existing?.reviewStatus === 'APPROVED') {
      throw new ConflictException({
        title: 'Return preparation is locked',
        detail: 'Demote approval before editing notes.',
      })
    }

    const priorJson =
      existing?.structuredJson && typeof existing.structuredJson === 'object'
        ? (existing.structuredJson as Record<string, unknown>)
        : {}

    let structuredJson: Record<string, unknown> = { ...priorJson }
    if (body.structuredJson && typeof body.structuredJson === 'object') {
      // Preserve assembled validation/fields; only merge notes from client payload
      structuredJson = { ...priorJson, ...body.structuredJson }
      if (priorJson.fields) structuredJson.fields = priorJson.fields
      if (priorJson.validation) structuredJson.validation = priorJson.validation
      if (priorJson.missing) structuredJson.missing = priorJson.missing
      if (priorJson.sections) structuredJson.sections = priorJson.sections
    }
    if (body.notes !== undefined) {
      structuredJson = { ...structuredJson, notes: body.notes }
    }

    const saved = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.upsert({
        where: { taxYearFileId },
        create: {
          id: randomUUID(),
          taxYearFileId,
          firmId: file.firmId,
          structuredJson: structuredJson as Prisma.InputJsonValue,
          reviewStatus: 'DRAFT',
        },
        update: {
          structuredJson: structuredJson as Prisma.InputJsonValue,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'return_preparation.upsert',
      resourceType: 'return_preparation',
      resourceId: saved.id,
      payload: { taxYearFileId, reviewStatus: saved.reviewStatus },
    })

    return this.toDto(saved)
  }

  /** Assemble structured draft from workspace entities. Does not invent tax rules or claim filing. */
  async assemble(user: AuthenticatedUser, taxYearFileId: string) {
    const fileMeta = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)

    const existing = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.findUnique({ where: { taxYearFileId } }),
    )
    if (existing?.reviewStatus === 'APPROVED') {
      throw new ConflictException({
        title: 'Return preparation is approved',
        detail: 'Demote review status before reassembling the draft.',
      })
    }

    const bundle = await this.prismaRls.withRlsContext(async (tx) => {
      const file = await tx.taxYearFile.findFirst({
        where: { id: taxYearFileId },
        select: {
          id: true,
          clientId: true,
          taxYear: true,
          rulesVersion: true,
          sections: true,
        },
      })
      if (!file) {
        throw new ConflictException({ title: 'Tax year not found during assemble' })
      }

      const wealth = await tx.wealthStatement.findUnique({ where: { taxYearFileId } })
      const withholding = await tx.withholdingEntry.findMany({ where: { taxYearFileId } })
      const computation = await tx.taxComputationSnapshot.findFirst({
        where: { taxYearFileId },
        orderBy: { createdAt: 'desc' },
      })
      const documentCount = await tx.document.count({ where: { taxYearFileId } })

      const priorNotes =
        existing?.structuredJson &&
        typeof existing.structuredJson === 'object' &&
        existing.structuredJson !== null &&
        'notes' in existing.structuredJson &&
        typeof (existing.structuredJson as { notes?: unknown }).notes === 'string'
          ? (existing.structuredJson as { notes: string }).notes
          : undefined

      return { file, wealth, withholding, computation, documentCount, priorNotes }
    })

    const draft = assembleReturnDraft({
      taxYear: bundle.file.taxYear,
      clientId: bundle.file.clientId,
      rulesVersion: bundle.file.rulesVersion,
      sections:
        bundle.file.sections && typeof bundle.file.sections === 'object'
          ? (bundle.file.sections as Record<string, unknown>)
          : {},
      wealth: bundle.wealth
        ? {
            status: bundle.wealth.status,
            reviewStatus: bundle.wealth.reviewStatus,
            discrepancyPaisa: bundle.wealth.discrepancy.toString(),
          }
        : null,
      withholding: bundle.withholding.map((w) => ({
        matched: w.matched,
        taxDeductedPaisa: w.taxDeductedPaisa.toString(),
      })),
      computation: bundle.computation
        ? {
            snapshotId: bundle.computation.id,
            status: bundle.computation.status,
            rulesVersion: bundle.computation.rulesVersion,
            resultJson: bundle.computation.resultJson,
          }
        : null,
      documentCount: bundle.documentCount,
      ...(bundle.priorNotes !== undefined ? { notes: bundle.priorNotes } : {}),
    })

    const parsed = ReturnPrepDraftV1Schema.parse(draft)

    const saved = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.upsert({
        where: { taxYearFileId },
        create: {
          id: randomUUID(),
          taxYearFileId,
          firmId: fileMeta.firmId,
          structuredJson: parsed as unknown as Prisma.InputJsonValue,
          reviewStatus: existing?.reviewStatus === 'IN_REVIEW' ? 'IN_REVIEW' : 'DRAFT',
        },
        update: {
          structuredJson: parsed as unknown as Prisma.InputJsonValue,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'return_preparation.assemble',
      resourceType: 'return_preparation',
      resourceId: saved.id,
      payload: {
        taxYearFileId,
        reviewStatus: saved.reviewStatus,
        rulesState: parsed.rulesState,
        validationStatus: parsed.validation.status,
      },
    })

    return this.toDto(saved)
  }

  async submitForReview(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    const row = await this.requireRow(taxYearFileId)

    if (row.reviewStatus === 'APPROVED') {
      throw new ConflictException({
        title: 'Already approved',
        detail: 'Demote before submitting for review again.',
      })
    }
    if (row.reviewStatus === 'IN_REVIEW') {
      return this.toDto(row)
    }

    const draft = this.parseDraft(row.structuredJson)
    if (!draft?.validation.canSubmitForReview) {
      throw new BadRequestException({
        title: 'Not ready for review',
        detail: 'Resolve blocking validation issues, then assemble again before submitting.',
      })
    }

    const saved = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.update({
        where: { id: row.id },
        data: {
          reviewStatus: 'IN_REVIEW',
          submittedAt: new Date(),
          submittedById: user.userId,
          approvedAt: null,
          approvedById: null,
          approvalComment: null,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'return_preparation.submit_review',
      resourceType: 'return_preparation',
      resourceId: saved.id,
      payload: { taxYearFileId, from: 'DRAFT', to: 'IN_REVIEW' },
    })

    return this.toDto(saved)
  }

  async approve(user: AuthenticatedUser, taxYearFileId: string, body: ApproveReturnPrepBody) {
    if (!APPROVER_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        title: 'Insufficient role',
        detail: 'Only OWNER, MANAGER, or REVIEWER may approve return preparation.',
      })
    }

    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    const row = await this.requireRow(taxYearFileId)

    if (row.reviewStatus === 'APPROVED') {
      return this.toDto(row)
    }
    if (row.reviewStatus !== 'IN_REVIEW') {
      throw new ConflictException({
        title: 'Not in review',
        detail: 'Submit for review before approving.',
      })
    }

    const draft = this.parseDraft(row.structuredJson)
    if (!draft?.validation.canApprove) {
      throw new BadRequestException({
        title: 'Approval blocked',
        detail:
          'Validation gate failed. Draft/placeholder rules or incomplete verified data cannot be approved.',
      })
    }
    if (draft.rulesState === 'DRAFT' || draft.rulesState === 'UNAVAILABLE') {
      throw new BadRequestException({
        title: 'Rules blocked',
        detail: 'Draft or unavailable tax rules keep approval fail-closed.',
      })
    }

    const saved = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.update({
        where: { id: row.id },
        data: {
          reviewStatus: 'APPROVED',
          approvedAt: new Date(),
          approvedById: user.userId,
          approvalComment: body.comment ?? null,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'return_preparation.approve',
      resourceType: 'return_preparation',
      resourceId: saved.id,
      payload: {
        taxYearFileId,
        from: 'IN_REVIEW',
        to: 'APPROVED',
        comment: body.comment ?? null,
      },
    })

    return this.toDto(saved)
  }

  async demote(user: AuthenticatedUser, taxYearFileId: string, body: DemoteReturnPrepBody) {
    if (!APPROVER_ROLES.includes(user.role) && user.role !== UserRole.ASSOCIATE) {
      throw new ForbiddenException({ title: 'Insufficient role' })
    }
    // Associates may demote only their own IN_REVIEW → DRAFT; approvers may demote APPROVED
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    const row = await this.requireRow(taxYearFileId)

    if (row.reviewStatus === 'DRAFT' && body.targetStatus === 'DRAFT') {
      return this.toDto(row)
    }

    if (row.reviewStatus === 'APPROVED' && !APPROVER_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        title: 'Insufficient role',
        detail: 'Only OWNER, MANAGER, or REVIEWER may demote an approved return preparation.',
      })
    }

    if (body.targetStatus === 'IN_REVIEW' && row.reviewStatus === 'DRAFT') {
      throw new BadRequestException({
        title: 'Invalid demotion',
        detail: 'Use submit-for-review to move from DRAFT to IN_REVIEW.',
      })
    }

    const from = row.reviewStatus
    const saved = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.update({
        where: { id: row.id },
        data: {
          reviewStatus: body.targetStatus,
          approvedAt: null,
          approvedById: null,
          approvalComment: body.comment ?? null,
          ...(body.targetStatus === 'DRAFT' ? { submittedAt: null, submittedById: null } : {}),
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'return_preparation.demote',
      resourceType: 'return_preparation',
      resourceId: saved.id,
      payload: {
        taxYearFileId,
        from,
        to: body.targetStatus,
        comment: body.comment ?? null,
      },
    })

    return this.toDto(saved)
  }

  async activity(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    const row = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.findUnique({ where: { taxYearFileId } }),
    )
    if (!row) return []

    return this.prismaRls.withRlsContext(async (tx) => {
      const logs = await tx.auditLog.findMany({
        where: {
          firmId: user.firmId,
          resourceType: 'return_preparation',
          resourceId: row.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          userId: true,
          createdAt: true,
          after: true,
        },
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

  private async requireRow(taxYearFileId: string) {
    const row = await this.prismaRls.withRlsContext(async (tx) =>
      tx.returnPreparation.findUnique({ where: { taxYearFileId } }),
    )
    if (!row) {
      throw new NotFoundException({
        title: 'Return preparation not found',
        detail: 'Assemble a draft before changing review status.',
      })
    }
    return row
  }

  private parseDraft(structuredJson: Prisma.JsonValue) {
    const parsed = ReturnPrepDraftV1Schema.safeParse(structuredJson)
    return parsed.success ? parsed.data : null
  }

  private toDto(row: {
    id: string
    taxYearFileId: string
    structuredJson: Prisma.JsonValue
    reviewStatus: string
    assignedReviewerId?: string | null
    submittedAt?: Date | null
    submittedById?: string | null
    approvedAt?: Date | null
    approvedById?: string | null
    approvalComment?: string | null
    updatedAt: Date
  }) {
    return {
      id: row.id,
      taxYearFileId: row.taxYearFileId,
      structuredJson:
        row.structuredJson && typeof row.structuredJson === 'object'
          ? (row.structuredJson as Record<string, unknown>)
          : {},
      reviewStatus: row.reviewStatus,
      assignedReviewerId: row.assignedReviewerId ?? null,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      submittedById: row.submittedById ?? null,
      approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
      approvedById: row.approvedById ?? null,
      approvalComment: row.approvalComment ?? null,
      disclaimerKey: 'taxPlanning.disclaimer' as const,
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
