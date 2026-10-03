import { Injectable } from '@nestjs/common'
import {
  DocumentExtractionStatus,
  DocumentReviewStatus,
  DocumentStatus,
  InvoiceStatus,
  NoticeStatus,
  ReturnPrepReviewStatus,
  TaxYearStatus,
  UserRole,
} from '@prisma/client'
import type { AnalyticsOverview } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuthenticatedUser } from '../auth/auth.types'
import { assertStaffSession } from '../tax-years/tax-year-access.util'

const UPCOMING_WINDOW_DAYS = 30
const UPCOMING_LIST_LIMIT = 10

const OPEN_NOTICE_STATUSES: NoticeStatus[] = [NoticeStatus.OPEN, NoticeStatus.IN_PROGRESS]
const OPEN_TAX_YEAR_STATUSES: TaxYearStatus[] = [
  TaxYearStatus.INTAKE,
  TaxYearStatus.IN_PROGRESS,
  TaxYearStatus.UNDER_REVIEW,
  TaxYearStatus.APPROVED,
]

@Injectable()
export class AnalyticsService {
  constructor(private readonly prismaRls: PrismaRlsClient) {}

  async getOverview(user: AuthenticatedUser): Promise<AnalyticsOverview> {
    assertStaffSession(user)
    const firmId = user.firmId
    const now = new Date()
    const horizon = new Date(now)
    horizon.setDate(horizon.getDate() + UPCOMING_WINDOW_DAYS)

    return this.prismaRls.withRlsContext(async (tx) => {
      const [
        activeClients,
        taxYearGroups,
        pendingDocuments,
        pendingReviews,
        openNotices,
        invoiceRows,
        paymentAgg,
        upcomingComplianceCount,
        upcomingTaxYearDueCount,
        upcomingNoticeDeadlineCount,
        noticeDeadlineRows,
        complianceRows,
        taxYearDueRows,
        taxYearAssigneeGroups,
        noticeAssigneeGroups,
        staffUsers,
        returnPrepGroups,
      ] = await Promise.all([
        tx.client.count({ where: { firmId, isArchived: false } }),
        tx.taxYearFile.groupBy({
          by: ['status'],
          where: { client: { firmId, isArchived: false } },
          _count: { _all: true },
        }),
        tx.document.count({
          where: {
            firmId,
            status: { not: DocumentStatus.FAILED },
            reviewStatus: { not: DocumentReviewStatus.APPROVED },
          },
        }),
        tx.document.count({
          where: {
            firmId,
            OR: [
              { reviewStatus: DocumentReviewStatus.IN_REVIEW },
              {
                reviewStatus: DocumentReviewStatus.NOT_STARTED,
                extractionStatus: DocumentExtractionStatus.COMPLETE,
              },
            ],
          },
        }),
        tx.notice.count({
          where: { firmId, status: { in: OPEN_NOTICE_STATUSES } },
        }),
        tx.invoice.findMany({
          where: { firmId },
          select: { status: true, balancePaisa: true },
        }),
        tx.payment.aggregate({
          where: { firmId },
          _sum: { amountPaisa: true },
        }),
        tx.complianceEvent.count({
          where: { firmId, eventAt: { gte: now, lte: horizon } },
        }),
        tx.taxYearFile.count({
          where: {
            client: { firmId, isArchived: false },
            status: { in: OPEN_TAX_YEAR_STATUSES },
            dueDate: { gte: now, lte: horizon },
          },
        }),
        tx.notice.count({
          where: {
            firmId,
            status: { in: OPEN_NOTICE_STATUSES },
            deadline: { gte: now, lte: horizon },
          },
        }),
        tx.notice.findMany({
          where: {
            firmId,
            status: { in: OPEN_NOTICE_STATUSES },
            deadline: { gte: now, lte: horizon },
          },
          select: {
            id: true,
            title: true,
            deadline: true,
            clientId: true,
          },
          take: UPCOMING_LIST_LIMIT,
          orderBy: { deadline: 'asc' },
        }),
        tx.complianceEvent.findMany({
          where: { firmId, eventAt: { gte: now, lte: horizon } },
          select: {
            id: true,
            title: true,
            eventAt: true,
            clientId: true,
          },
          take: UPCOMING_LIST_LIMIT,
          orderBy: { eventAt: 'asc' },
        }),
        tx.taxYearFile.findMany({
          where: {
            client: { firmId, isArchived: false },
            status: { in: OPEN_TAX_YEAR_STATUSES },
            dueDate: { gte: now, lte: horizon },
          },
          select: {
            id: true,
            dueDate: true,
            taxYear: true,
            clientId: true,
          },
          take: UPCOMING_LIST_LIMIT,
          orderBy: { dueDate: 'asc' },
        }),
        tx.taxYearFile.groupBy({
          by: ['assigneeId'],
          where: {
            client: { firmId, isArchived: false },
            status: { in: OPEN_TAX_YEAR_STATUSES },
          },
          _count: { _all: true },
        }),
        tx.notice.groupBy({
          by: ['assigneeId'],
          where: { firmId, status: { in: OPEN_NOTICE_STATUSES } },
          _count: { _all: true },
        }),
        tx.user.findMany({
          where: {
            firmId,
            role: { not: UserRole.CLIENT },
            isActive: true,
          },
          select: { id: true, name: true },
        }),
        tx.returnPreparation.groupBy({
          by: ['reviewStatus'],
          where: { firmId },
          _count: { _all: true },
        }),
      ])

      const taxYearByStatus = Object.fromEntries(
        Object.values(TaxYearStatus).map((s) => [s, 0]),
      ) as Record<TaxYearStatus, number>
      for (const row of taxYearGroups) {
        taxYearByStatus[row.status] = row._count._all
      }

      const returnPrepByStatus = Object.fromEntries(
        Object.values(ReturnPrepReviewStatus).map((s) => [s, 0]),
      ) as Record<ReturnPrepReviewStatus, number>
      for (const row of returnPrepGroups) {
        returnPrepByStatus[row.reviewStatus] = row._count._all
      }

      const countByStatus: Record<string, number> = {}
      let totalOutstanding = 0n
      for (const inv of invoiceRows) {
        countByStatus[inv.status] = (countByStatus[inv.status] ?? 0) + 1
        if (inv.status !== InvoiceStatus.VOID && inv.status !== InvoiceStatus.PAID) {
          totalOutstanding += inv.balancePaisa
        }
      }

      const deadlineCandidates = [
        ...complianceRows.map((e) => ({
          kind: 'compliance_event' as const,
          title: e.title,
          dueAt: e.eventAt,
          clientId: e.clientId,
          resourceId: e.id,
        })),
        ...taxYearDueRows.map((f) => ({
          kind: 'tax_year_due' as const,
          title: `Tax year ${f.taxYear}`,
          dueAt: f.dueDate!,
          clientId: f.clientId,
          resourceId: f.id,
        })),
        ...noticeDeadlineRows.map((n) => ({
          kind: 'notice' as const,
          title: n.title,
          dueAt: n.deadline!,
          clientId: n.clientId,
          resourceId: n.id,
        })),
      ]
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
        .slice(0, UPCOMING_LIST_LIMIT)

      const userNameById = new Map(staffUsers.map((u) => [u.id, u.name]))
      const workloadMap = new Map<string | null, { openTaxYears: number; openNotices: number }>()

      const bump = (userId: string | null, field: 'openTaxYears' | 'openNotices', n: number) => {
        const cur = workloadMap.get(userId) ?? { openTaxYears: 0, openNotices: 0 }
        cur[field] += n
        workloadMap.set(userId, cur)
      }

      for (const row of taxYearAssigneeGroups) {
        bump(row.assigneeId, 'openTaxYears', row._count._all)
      }
      for (const row of noticeAssigneeGroups) {
        bump(row.assigneeId, 'openNotices', row._count._all)
      }

      const staffWorkload = [...workloadMap.entries()]
        .map(([userId, counts]) => ({
          userId,
          name: userId ? (userNameById.get(userId) ?? 'Unknown') : 'Unassigned',
          openTaxYears: counts.openTaxYears,
          openNotices: counts.openNotices,
        }))
        .sort((a, b) => b.openTaxYears + b.openNotices - (a.openTaxYears + a.openNotices))

      return {
        activeClients,
        taxYearByStatus,
        returnPrepByStatus,
        pendingDocuments,
        pendingReviews,
        upcomingDeadlinesCount:
          upcomingComplianceCount + upcomingTaxYearDueCount + upcomingNoticeDeadlineCount,
        upcomingDeadlines: deadlineCandidates.map((d) => ({
          kind: d.kind,
          title: d.title,
          dueAt: d.dueAt.toISOString(),
          clientId: d.clientId,
          resourceId: d.resourceId,
        })),
        openNotices,
        invoices: {
          totalOutstandingPaisa: totalOutstanding.toString(),
          totalCollectedPaisa: (paymentAgg._sum.amountPaisa ?? 0n).toString(),
          countByStatus,
        },
        staffWorkload,
      }
    })
  }
}
