import { z } from 'zod'

import {
  CnicSchema,
  emptyStringToUndefined,
  NtnSchema,
  PaginationQuerySchema,
  UuidSchema,
} from './common'

const OptionalCnicSchema = z.preprocess(emptyStringToUndefined, CnicSchema.optional())
const OptionalNtnSchema = z.preprocess(emptyStringToUndefined, NtnSchema.optional())

export const ClientTypeSchema = z.enum([
  'SALARIED_INDIVIDUAL',
  'BUSINESS_INDIVIDUAL',
  'AOP_PARTNERSHIP',
  'PRIVATE_LIMITED',
  'PROPERTY_OWNER',
  'OVERSEAS_PAKISTANI',
  'FREELANCER_IT_EXPORTER',
  'NON_PROFIT',
])

export const FilerStatusSchema = z.enum(['FILER', 'NON_FILER', 'UNKNOWN'])

export const ClientSortFieldSchema = z.enum([
  'displayName',
  'createdAt',
  'updatedAt',
  'filerStatus',
])
export const SortDirectionSchema = z.enum(['asc', 'desc'])

export const ListClientsQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  type: ClientTypeSchema.optional(),
  filerStatus: FilerStatusSchema.optional(),
  archived: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  sortBy: ClientSortFieldSchema.default('displayName'),
  sortDir: SortDirectionSchema.default('asc'),
})

export type ListClientsQuery = z.infer<typeof ListClientsQuerySchema>

export const CreateClientBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(200),
    type: ClientTypeSchema,
    cnic: OptionalCnicSchema,
    ntn: OptionalNtnSchema,
    filerStatus: FilerStatusSchema.optional(),
    aiConsentGiven: z.boolean().optional(),
    aiEnabled: z.boolean().optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((data) => data.cnic !== undefined || data.ntn !== undefined, {
    message: 'At least one of CNIC or NTN is required',
    path: ['cnic'],
  })

export type CreateClientBody = z.infer<typeof CreateClientBodySchema>

export const UpdateClientBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(200).optional(),
    type: ClientTypeSchema.optional(),
    cnic: OptionalCnicSchema,
    ntn: OptionalNtnSchema,
    filerStatus: FilerStatusSchema.optional(),
    aiConsentGiven: z.boolean().optional(),
    aiEnabled: z.boolean().optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

export type UpdateClientBody = z.infer<typeof UpdateClientBodySchema>

export const AddClientNoteBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

export type AddClientNoteBody = z.infer<typeof AddClientNoteBodySchema>

export const RevealClientFieldBodySchema = z.object({
  field: z.enum(['cnic', 'ntn']),
})

export type RevealClientFieldBody = z.infer<typeof RevealClientFieldBodySchema>

export const CheckDuplicateQuerySchema = z
  .object({
    cnic: OptionalCnicSchema,
    ntn: OptionalNtnSchema,
    excludeClientId: UuidSchema.optional(),
  })
  .refine((data) => data.cnic !== undefined || data.ntn !== undefined, {
    message: 'Provide cnic and/or ntn',
  })

export type CheckDuplicateQuery = z.infer<typeof CheckDuplicateQuerySchema>

export const ClientSummarySchema = z.object({
  id: UuidSchema,
  displayName: z.string(),
  type: ClientTypeSchema,
  filerStatus: FilerStatusSchema,
  isArchived: z.boolean(),
  cnicMasked: z.string().nullable(),
  ntnMasked: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ClientSummary = z.infer<typeof ClientSummarySchema>

export const ClientDetailSchema = ClientSummarySchema.extend({
  aiConsentGiven: z.boolean(),
  aiEnabled: z.boolean(),
  notes: z.string().nullable(),
})

export type ClientDetail = z.infer<typeof ClientDetailSchema>

export const PaginatedClientsSchema = z.object({
  items: z.array(ClientSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().nonnegative(),
})

export const DuplicateCheckResultSchema = z.object({
  cnicMatch: z
    .object({
      clientId: UuidSchema,
      displayName: z.string(),
    })
    .nullable(),
  ntnMatch: z
    .object({
      clientId: UuidSchema,
      displayName: z.string(),
    })
    .nullable(),
})

export const ClientActivityItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['note', 'audit']),
  at: z.string(),
  summary: z.string(),
  authorName: z.string().nullable(),
})

export const ClientActivityListSchema = z.object({
  items: z.array(ClientActivityItemSchema),
})
