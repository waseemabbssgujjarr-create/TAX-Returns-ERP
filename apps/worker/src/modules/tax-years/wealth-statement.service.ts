import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import type { UpsertWealthStatementBody } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser, RequestMeta } from '../auth/auth.types'

import { resolveTaxYearFileForStaff } from './tax-year-access.util'
import { computeWealthReconciliation } from './wealth-reconciliation.util'

function parsePaisa(value: string): bigint {
  return BigInt(value)
}

@Injectable()
export class WealthStatementService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
  ) {}

  async get(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)

    return this.prismaRls.withRlsContext(async (tx) => {
      const row = await tx.wealthStatement.findUnique({ where: { taxYearFileId } })
      if (!row) return null
      return this.toDto(row)
    })
  }

  async upsert(
    user: AuthenticatedUser,
    taxYearFileId: string,
    body: UpsertWealthStatementBody,
    meta?: RequestMeta,
  ) {
    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)

    const opening = parsePaisa(body.openingWealthPaisa)
    const closing = parsePaisa(body.closingWealthPaisa)
    const income = parsePaisa(body.incomeTotalPaisa)
    const expense = parsePaisa(body.expenseTotalPaisa)
    const tax = parsePaisa(body.taxTotalPaisa)

    const reconciliation = computeWealthReconciliation({
      openingWealthPaisa: opening,
      closingWealthPaisa: closing,
      incomeTotalPaisa: income,
      expenseTotalPaisa: expense,
      taxTotalPaisa: tax,
    })

    const saved = await this.prismaRls.withRlsContext(async (tx) => {
      return tx.wealthStatement.upsert({
        where: { taxYearFileId },
        create: {
          id: randomUUID(),
          taxYearFileId,
          firmId: file.firmId,
          openingWealth: opening,
          closingWealth: closing,
          incomeTotal: income,
          expenseTotal: expense,
          taxTotal: tax,
          discrepancy: reconciliation.discrepancyPaisa,
          status: reconciliation.status,
          explanation: body.explanation ?? null,
          reviewStatus: body.reviewStatus ?? 'NOT_STARTED',
        },
        update: {
          openingWealth: opening,
          closingWealth: closing,
          incomeTotal: income,
          expenseTotal: expense,
          taxTotal: tax,
          discrepancy: reconciliation.discrepancyPaisa,
          status: reconciliation.status,
          ...(body.explanation !== undefined ? { explanation: body.explanation } : {}),
          ...(body.reviewStatus !== undefined ? { reviewStatus: body.reviewStatus } : {}),
        },
      })
    })

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'wealth_statement.upsert',
      resourceType: 'wealth_statement',
      resourceId: saved.id,
      ...(meta?.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
      ...(meta?.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
      payload: {
        taxYearFileId,
        status: saved.status,
        discrepancyPaisa: saved.discrepancy.toString(),
      },
    })

    return this.toDto(saved)
  }

  private toDto(row: {
    id: string
    taxYearFileId: string
    openingWealth: bigint
    closingWealth: bigint
    incomeTotal: bigint
    expenseTotal: bigint
    taxTotal: bigint
    discrepancy: bigint
    status: string
    explanation: string | null
    reviewStatus: string
    updatedAt: Date
  }) {
    const expected = row.openingWealth + row.incomeTotal - row.expenseTotal - row.taxTotal
    return {
      id: row.id,
      taxYearFileId: row.taxYearFileId,
      openingWealthPaisa: row.openingWealth.toString(),
      closingWealthPaisa: row.closingWealth.toString(),
      incomeTotalPaisa: row.incomeTotal.toString(),
      expenseTotalPaisa: row.expenseTotal.toString(),
      taxTotalPaisa: row.taxTotal.toString(),
      discrepancyPaisa: row.discrepancy.toString(),
      expectedClosingPaisa: expected.toString(),
      status: row.status,
      explanation: row.explanation,
      reviewStatus: row.reviewStatus,
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
