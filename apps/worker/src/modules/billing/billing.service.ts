import { randomUUID } from 'node:crypto'

import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { InvoiceStatus } from '@prisma/client'
import type { CreateInvoiceBody, ListInvoicesQuery, RecordPaymentBody } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'
import { assertStaffSession } from '../tax-years/tax-year-access.util'

@Injectable()
export class BillingService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
  ) {}

  async listInvoices(user: AuthenticatedUser, query: ListInvoicesQuery) {
    assertStaffSession(user)
    const where = {
      firmId: user.firmId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const [total, rows] = await Promise.all([
        tx.invoice.count({ where }),
        tx.invoice.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])
      return {
        items: rows.map((r) => this.toSummary(r)),
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      }
    })
  }

  async createInvoice(user: AuthenticatedUser, body: CreateInvoiceBody) {
    assertStaffSession(user)
    const amount = BigInt(body.amountPaisa)

    const created = await this.prismaRls.withRlsContext(async (tx) =>
      tx.invoice.create({
        data: {
          id: randomUUID(),
          firmId: user.firmId,
          clientId: body.clientId,
          invoiceNumber: body.invoiceNumber,
          amountPaisa: amount,
          balancePaisa: amount,
          status: InvoiceStatus.DRAFT,
          visibleToClient: body.visibleToClient ?? false,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'invoice.create',
      resourceType: 'invoice',
      resourceId: created.id,
      payload: { clientId: body.clientId, amountPaisa: body.amountPaisa },
    })

    return this.toSummary(created)
  }

  async recordPayment(user: AuthenticatedUser, invoiceId: string, body: RecordPaymentBody) {
    assertStaffSession(user)
    const paymentAmount = BigInt(body.amountPaisa)

    return this.prismaRls.withRlsContext(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, firmId: user.firmId },
      })
      if (!invoice) {
        throw new NotFoundException({ title: 'Invoice not found' })
      }
      if (invoice.status === InvoiceStatus.VOID) {
        throw new UnprocessableEntityException({ title: 'Cannot pay a void invoice' })
      }

      const newBalance = invoice.balancePaisa - paymentAmount
      if (newBalance < 0n) {
        throw new UnprocessableEntityException({ title: 'Payment exceeds balance' })
      }

      await tx.payment.create({
        data: {
          id: randomUUID(),
          firmId: user.firmId,
          invoiceId,
          amountPaisa: paymentAmount,
          paidAt: new Date(body.paidAt),
          reference: body.reference ?? null,
        },
      })

      let status = invoice.status
      if (newBalance === 0n) status = InvoiceStatus.PAID
      else if (newBalance < invoice.amountPaisa) status = InvoiceStatus.PARTIALLY_PAID

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { balancePaisa: newBalance, status },
      })

      await this.audit.log({
        firmId: user.firmId,
        userId: user.userId,
        action: 'payment.record',
        resourceType: 'invoice',
        resourceId: invoiceId,
        payload: { amountPaisa: body.amountPaisa },
      })

      return this.toSummary(updated)
    })
  }

  private toSummary(row: {
    id: string
    clientId: string
    invoiceNumber: string
    amountPaisa: bigint
    balancePaisa: bigint
    status: InvoiceStatus
    visibleToClient: boolean
    dueDate: Date | null
    createdAt: Date
  }) {
    return {
      id: row.id,
      clientId: row.clientId,
      invoiceNumber: row.invoiceNumber,
      amountPaisa: row.amountPaisa.toString(),
      balancePaisa: row.balancePaisa.toString(),
      status: row.status,
      visibleToClient: row.visibleToClient,
      dueDate: row.dueDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
