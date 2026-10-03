import { randomUUID } from 'node:crypto'

import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { loadRules, RulesLoadError } from '@taxdesk/rules'
import type {
  CreateComplianceEventBody,
  CreateNoticeBody,
  ListComplianceEventsQuery,
  ListNoticesQuery,
  PenaltyEstimateBody,
  PenaltyEstimateResult,
  UpdateNoticeBody,
} from '@taxdesk/schemas'
import { calculateLateFilingPenalty } from '@taxdesk/tax-engine'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'
import { assertStaffSession } from '../tax-years/tax-year-access.util'

const DRAFT_VERSION_MARKERS = ['DRAFT', 'PLACEHOLDER', 'PENDING']

function isDraftVersion(version: string): boolean {
  const upper = version.toUpperCase()
  return DRAFT_VERSION_MARKERS.some((m) => upper.includes(m))
}

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
  ) {}

  async listNotices(user: AuthenticatedUser, query: ListNoticesQuery) {
    assertStaffSession(user)
    const where: Prisma.NoticeWhereInput = { firmId: user.firmId }
    if (query.clientId) where.clientId = query.clientId
    if (query.status) where.status = query.status

    return this.prismaRls.withRlsContext(async (tx) => {
      const [total, rows] = await Promise.all([
        tx.notice.count({ where }),
        tx.notice.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])
      return {
        items: rows.map((r) => this.noticeToSummary(r)),
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      }
    })
  }

  async createNotice(user: AuthenticatedUser, body: CreateNoticeBody) {
    assertStaffSession(user)

    const created = await this.prismaRls.withRlsContext(async (tx) =>
      tx.notice.create({
        data: {
          id: randomUUID(),
          firmId: user.firmId,
          clientId: body.clientId,
          taxYearFileId: body.taxYearFileId ?? null,
          title: body.title,
          description: body.description ?? null,
          deadline: body.deadline ? new Date(body.deadline) : null,
          assigneeId: body.assigneeId ?? null,
          documentIds: body.documentIds,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'notice.create',
      resourceType: 'notice',
      resourceId: created.id,
      payload: { clientId: body.clientId },
    })

    return this.noticeToSummary(created)
  }

  async updateNotice(user: AuthenticatedUser, noticeId: string, body: UpdateNoticeBody) {
    assertStaffSession(user)

    return this.prismaRls.withRlsContext(async (tx) => {
      const existing = await tx.notice.findFirst({
        where: { id: noticeId, firmId: user.firmId },
      })
      if (!existing) {
        throw new NotFoundException({ title: 'Notice not found' })
      }

      const updated = await tx.notice.update({
        where: { id: noticeId },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.deadline !== undefined
            ? { deadline: body.deadline ? new Date(body.deadline) : null }
            : {}),
          ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.documentIds !== undefined ? { documentIds: body.documentIds } : {}),
        },
      })

      await this.audit.log({
        firmId: user.firmId,
        userId: user.userId,
        action: 'notice.update',
        resourceType: 'notice',
        resourceId: noticeId,
        payload: { status: updated.status },
      })

      return this.noticeToSummary(updated)
    })
  }

  async listComplianceEvents(user: AuthenticatedUser, query: ListComplianceEventsQuery) {
    assertStaffSession(user)
    const where: Prisma.ComplianceEventWhereInput = { firmId: user.firmId }
    if (query.from || query.to) {
      where.eventAt = {}
      if (query.from) where.eventAt.gte = new Date(query.from)
      if (query.to) where.eventAt.lte = new Date(query.to)
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const [total, rows] = await Promise.all([
        tx.complianceEvent.count({ where }),
        tx.complianceEvent.findMany({
          where,
          orderBy: { eventAt: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])
      return {
        items: rows.map((r) => this.eventToDto(r)),
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      }
    })
  }

  async createComplianceEvent(user: AuthenticatedUser, body: CreateComplianceEventBody) {
    assertStaffSession(user)

    const created = await this.prismaRls.withRlsContext(async (tx) =>
      tx.complianceEvent.create({
        data: {
          id: randomUUID(),
          firmId: user.firmId,
          clientId: body.clientId ?? null,
          taxYearFileId: body.taxYearFileId ?? null,
          kind: body.kind,
          title: body.title,
          eventAt: new Date(body.eventAt),
          metadata: (body.metadata ?? {}) as Prisma.InputJsonValue,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'compliance_event.create',
      resourceType: 'compliance_event',
      resourceId: created.id,
      payload: { kind: body.kind },
    })

    return this.eventToDto(created)
  }

  /**
   * Late-filing / ATL-surcharge penalty estimate (F3). Fails closed and honest: if the
   * rules pack for the tax year is still DRAFT/unreviewed, returns `available: false`
   * with a blocked reason instead of fabricating a figure a consultant could rely on.
   */
  estimatePenalty(user: AuthenticatedUser, body: PenaltyEstimateBody): PenaltyEstimateResult {
    assertStaffSession(user)

    let rules
    try {
      rules = loadRules(body.taxYear)
    } catch (e) {
      return {
        available: false,
        rulesVersion: null,
        penaltyPaisa: null,
        minimumAppliedPaisa: null,
        cappedAtMaxPaisa: false,
        reductionPercentApplied: null,
        explanationKeys: [],
        blockedReason: e instanceof RulesLoadError ? e.message : String(e),
      }
    }

    if (isDraftVersion(rules.version)) {
      return {
        available: false,
        rulesVersion: rules.version,
        penaltyPaisa: null,
        minimumAppliedPaisa: null,
        cappedAtMaxPaisa: false,
        reductionPercentApplied: null,
        explanationKeys: [],
        blockedReason: `Penalty rules for TY${body.taxYear} (version ${rules.version}) are DRAFT and have not been professionally reviewed. Estimate is blocked.`,
      }
    }

    const outcome = calculateLateFilingPenalty(
      {
        filingKind: body.filingKind,
        clientType: body.clientType,
        taxPayablePaisa: BigInt(body.taxPayablePaisa),
        daysLate: body.daysLate,
      },
      rules,
    )

    if (outcome.isErr()) {
      return {
        available: false,
        rulesVersion: rules.version,
        penaltyPaisa: null,
        minimumAppliedPaisa: null,
        cappedAtMaxPaisa: false,
        reductionPercentApplied: null,
        explanationKeys: [],
        blockedReason: outcome.error.message,
      }
    }

    const result = outcome.value
    return {
      available: true,
      rulesVersion: rules.version,
      penaltyPaisa: result.penaltyPaisa.toString(),
      minimumAppliedPaisa: result.minimumAppliedPaisa?.toString() ?? null,
      cappedAtMaxPaisa: result.cappedAtMax,
      reductionPercentApplied: result.reductionPercentApplied,
      explanationKeys: result.explanationKeys,
      blockedReason: null,
    }
  }

  private noticeToSummary(row: {
    id: string
    clientId: string
    taxYearFileId: string | null
    title: string
    status: string
    deadline: Date | null
    assigneeId: string | null
    createdAt: Date
  }) {
    return {
      id: row.id,
      clientId: row.clientId,
      taxYearFileId: row.taxYearFileId,
      title: row.title,
      status: row.status,
      deadline: row.deadline?.toISOString() ?? null,
      assigneeId: row.assigneeId,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private eventToDto(row: {
    id: string
    clientId: string | null
    taxYearFileId: string | null
    kind: string
    title: string
    eventAt: Date
    reminderSentAt: Date | null
    createdAt: Date
  }) {
    return {
      id: row.id,
      clientId: row.clientId,
      taxYearFileId: row.taxYearFileId,
      kind: row.kind,
      title: row.title,
      eventAt: row.eventAt.toISOString(),
      reminderSentAt: row.reminderSentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
