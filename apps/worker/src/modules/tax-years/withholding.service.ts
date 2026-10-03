import { randomUUID } from 'node:crypto'

import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreateWithholdingEntryBody, UpdateWithholdingEntryBody } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'

import { resolveTaxYearFileForStaff } from './tax-year-access.util'
import { validateWhtRow } from './wht-row-validator.util'
import { matchWithholdingToCredits } from './withholding-reconciliation.util'

type EntryRow = {
  id: string
  taxYearFileId: string
  source: string
  amountPaisa: bigint
  taxDeductedPaisa: bigint
  certificateRef: string | null
  documentId: string | null
  matched: boolean
  reviewStatus: string
  registrationNo: string | null
  payeeName: string | null
  transactionDate: Date | null
  whtCode: string | null
  exemptionCode: string | null
  cprReference: string | null
  validationStatus: string
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class WithholdingService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    return this.prismaRls.withRlsContext(async (tx) => {
      const rows = await tx.withholdingEntry.findMany({
        where: { taxYearFileId },
        orderBy: { createdAt: 'desc' },
      })
      return { items: rows.map((r) => this.toDto(r)) }
    })
  }

  async create(user: AuthenticatedUser, taxYearFileId: string, body: CreateWithholdingEntryBody) {
    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)

    const transactionDate = body.transactionDate ? new Date(body.transactionDate) : null
    const validationStatus = validateWhtRow({
      registrationNo: body.registrationNo ?? null,
      payeeName: body.payeeName ?? null,
      transactionDate,
      whtCode: body.whtCode ?? null,
      taxYear: file.taxYear,
    })

    const created = await this.prismaRls.withRlsContext(async (tx) =>
      tx.withholdingEntry.create({
        data: {
          id: randomUUID(),
          taxYearFileId,
          firmId: file.firmId,
          source: body.source,
          amountPaisa: BigInt(body.amountPaisa),
          taxDeductedPaisa: BigInt(body.taxDeductedPaisa ?? '0'),
          certificateRef: body.certificateRef ?? null,
          documentId: body.documentId ?? null,
          reviewStatus: body.reviewStatus ?? 'NOT_STARTED',
          registrationNo: body.registrationNo ?? null,
          payeeName: body.payeeName ?? null,
          transactionDate,
          whtCode: body.whtCode ?? null,
          exemptionCode: body.exemptionCode ?? null,
          cprReference: body.cprReference ?? null,
          validationStatus,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'withholding_entry.create',
      resourceType: 'withholding_entry',
      resourceId: created.id,
      payload: { taxYearFileId, source: body.source, validationStatus },
    })

    return this.toDto(created)
  }

  async update(user: AuthenticatedUser, entryId: string, body: UpdateWithholdingEntryBody) {
    return this.prismaRls.withRlsContext(async (tx) => {
      const existing = await tx.withholdingEntry.findFirst({
        where: { id: entryId, firmId: user.firmId },
      })
      if (!existing) {
        throw new NotFoundException({ title: 'Withholding entry not found' })
      }
      const file = await resolveTaxYearFileForStaff(
        this.prismaRls,
        user,
        existing.taxYearFileId,
        tx,
      )

      const nextRegistrationNo =
        body.registrationNo !== undefined ? body.registrationNo : existing.registrationNo
      const nextPayeeName = body.payeeName !== undefined ? body.payeeName : existing.payeeName
      const nextTransactionDate =
        body.transactionDate !== undefined
          ? body.transactionDate
            ? new Date(body.transactionDate)
            : null
          : existing.transactionDate
      const nextWhtCode = body.whtCode !== undefined ? body.whtCode : existing.whtCode

      const validationStatus = validateWhtRow({
        registrationNo: nextRegistrationNo,
        payeeName: nextPayeeName,
        transactionDate: nextTransactionDate,
        whtCode: nextWhtCode,
        taxYear: file.taxYear,
      })

      const updated = await tx.withholdingEntry.update({
        where: { id: entryId },
        data: {
          ...(body.source !== undefined ? { source: body.source } : {}),
          ...(body.amountPaisa !== undefined ? { amountPaisa: BigInt(body.amountPaisa) } : {}),
          ...(body.taxDeductedPaisa !== undefined
            ? { taxDeductedPaisa: BigInt(body.taxDeductedPaisa) }
            : {}),
          ...(body.certificateRef !== undefined ? { certificateRef: body.certificateRef } : {}),
          ...(body.documentId !== undefined ? { documentId: body.documentId } : {}),
          ...(body.matched !== undefined ? { matched: body.matched } : {}),
          ...(body.reviewStatus !== undefined ? { reviewStatus: body.reviewStatus } : {}),
          registrationNo: nextRegistrationNo,
          payeeName: nextPayeeName,
          transactionDate: nextTransactionDate,
          whtCode: nextWhtCode,
          ...(body.exemptionCode !== undefined ? { exemptionCode: body.exemptionCode } : {}),
          ...(body.cprReference !== undefined ? { cprReference: body.cprReference } : {}),
          validationStatus,
        },
      })
      return this.toDto(updated)
    })
  }

  async reconcile(user: AuthenticatedUser, taxYearFileId: string) {
    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)

    return this.prismaRls.withRlsContext(async (tx) => {
      const [entries, snapshot] = await Promise.all([
        tx.withholdingEntry.findMany({ where: { taxYearFileId } }),
        tx.taxComputationSnapshot.findFirst({
          where: { taxYearFileId, status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
        }),
      ])

      const credits: Array<{ id: string; amountPaisa: bigint }> = []
      if (snapshot?.resultJson && typeof snapshot.resultJson === 'object') {
        const json = snapshot.resultJson as { credits?: Array<{ amountPaisa?: string }> }
        json.credits?.forEach((c, idx) => {
          if (c.amountPaisa) {
            credits.push({ id: `credit-${idx}`, amountPaisa: BigInt(c.amountPaisa) })
          }
        })
      }

      const matches = matchWithholdingToCredits(
        entries.map((e) => ({ id: e.id, amountPaisa: e.amountPaisa })),
        credits,
      )

      const updatedEntries = await Promise.all(
        matches.map((m) =>
          tx.withholdingEntry.update({
            where: { id: m.entryId },
            data: { matched: m.matched },
          }),
        ),
      )

      const unmatchedCount = updatedEntries.filter((e) => !e.matched).length

      await this.audit.log({
        firmId: file.firmId,
        userId: user.userId,
        action: 'withholding.reconcile',
        resourceType: 'tax_year_file',
        resourceId: taxYearFileId,
        payload: { unmatchedCount },
      })

      return {
        entries: updatedEntries.map((r) => this.toDto(r)),
        unmatchedCount,
      }
    })
  }

  /**
   * CPR-before-submit + all-rows-valid gate (F2 "IRIS gates mirrored"): IRIS blocks WHT
   * statement submission until the withheld tax is actually paid (CPR in hand). This
   * reproduces that gate for the firm's own pre-submission checklist.
   */
  async checklist(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)

    return this.prismaRls.withRlsContext(async (tx) => {
      const entries = await tx.withholdingEntry.findMany({ where: { taxYearFileId } })

      const invalidEntries = entries.filter((e) => e.validationStatus !== 'VALID')
      const missingCprEntries = entries.filter(
        (e) => e.taxDeductedPaisa > 0n && !e.cprReference,
      )

      const blockingReasons: string[] = []
      if (entries.length === 0) {
        blockingReasons.push('No withholding entries recorded yet.')
      }
      if (invalidEntries.length > 0) {
        blockingReasons.push(
          `${invalidEntries.length} row(s) fail IRIS validation (registration no. / code / name / transaction date).`,
        )
      }
      if (missingCprEntries.length > 0) {
        blockingReasons.push(
          `${missingCprEntries.length} row(s) have tax deducted but no CPR (Computerized Payment Receipt) on file.`,
        )
      }

      return {
        readyToSubmit: entries.length > 0 && invalidEntries.length === 0 && missingCprEntries.length === 0,
        totalEntries: entries.length,
        invalidEntries: invalidEntries.length,
        missingCprEntries: missingCprEntries.length,
        blockingReasons,
      }
    })
  }

  private toDto(row: EntryRow) {
    return {
      id: row.id,
      taxYearFileId: row.taxYearFileId,
      source: row.source,
      amountPaisa: row.amountPaisa.toString(),
      taxDeductedPaisa: row.taxDeductedPaisa.toString(),
      certificateRef: row.certificateRef,
      documentId: row.documentId,
      matched: row.matched,
      reviewStatus: row.reviewStatus,
      registrationNo: row.registrationNo,
      payeeName: row.payeeName,
      transactionDate: row.transactionDate?.toISOString() ?? null,
      whtCode: row.whtCode,
      exemptionCode: row.exemptionCode,
      cprReference: row.cprReference,
      validationStatus: row.validationStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
