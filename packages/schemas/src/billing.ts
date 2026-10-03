import { z } from 'zod'

import { PaisaStringSchema, PaginationQuerySchema, UuidSchema } from './common'

export const InvoiceStatusSchema = z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID'])

export const ListInvoicesQuerySchema = PaginationQuerySchema.extend({
  clientId: UuidSchema.optional(),
})

export type ListInvoicesQuery = z.infer<typeof ListInvoicesQuerySchema>

export const CreateInvoiceBodySchema = z.object({
  clientId: UuidSchema,
  invoiceNumber: z.string().min(1).max(40),
  amountPaisa: PaisaStringSchema,
  dueDate: z.string().datetime().optional(),
  visibleToClient: z.boolean().optional(),
})

export type CreateInvoiceBody = z.infer<typeof CreateInvoiceBodySchema>

export const RecordPaymentBodySchema = z.object({
  amountPaisa: PaisaStringSchema,
  paidAt: z.string().datetime(),
  reference: z.string().max(120).optional(),
})

export type RecordPaymentBody = z.infer<typeof RecordPaymentBodySchema>

export const InvoiceSummarySchema = z.object({
  id: UuidSchema,
  clientId: UuidSchema,
  invoiceNumber: z.string(),
  amountPaisa: PaisaStringSchema,
  balancePaisa: PaisaStringSchema,
  status: InvoiceStatusSchema,
  visibleToClient: z.boolean(),
  dueDate: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
