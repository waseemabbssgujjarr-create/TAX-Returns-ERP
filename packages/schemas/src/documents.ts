import { z } from 'zod'

import { PaginationQuerySchema, TaxYearSchema, UuidSchema } from './common'

export const DocumentCategorySchema = z.enum([
  'UNCATEGORIZED',
  'SALARY_CERTIFICATE',
  'BANK_STATEMENT',
  'WITHHOLDING_STATEMENT',
  'PROPERTY_DOCUMENT',
  'INVESTMENT_STATEMENT',
  'WEALTH_STATEMENT',
  'CNIC_COPY',
  'NTN_CERTIFICATE',
  'AOP_PARTNERSHIP_DEED',
  'COMPANY_INCORPORATION_DOCUMENT',
  'PRIOR_RETURN_COPY',
  'CPR_PAYMENT_RECEIPT',
  'OTHER',
])

export const DocumentStatusSchema = z.enum([
  'UPLOADED',
  'PROCESSING',
  'EXTRACTED',
  'REVIEWED',
  'VERIFIED',
  'FAILED',
])

export const DocumentProcessingStatusSchema = z.enum([
  'PENDING',
  'SECURITY_CHECK',
  'READING',
  'CLASSIFYING',
  'EXTRACTING',
  'READY',
  'FAILED',
])

export const DocumentExtractionStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETE',
  'FAILED',
  'SKIPPED',
])

export const DocumentReviewStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
])

export const ListDocumentsQuerySchema = PaginationQuerySchema.extend({
  /** Required for staff; portal sessions ignore this and use JWT clientId. */
  clientId: UuidSchema.optional(),
  taxYear: z.coerce.number().pipe(TaxYearSchema).optional(),
})

export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>

const optionalUuid = z
  .union([UuidSchema, z.literal('')])
  .optional()
  .transform((v) => (v === '' || v === undefined ? undefined : v))

export const UploadDocumentBodySchema = z
  .object({
    taxYearFileId: optionalUuid,
    clientId: optionalUuid,
    taxYear: z
      .union([z.coerce.number().pipe(TaxYearSchema), z.literal('')])
      .optional()
      .transform((v) => (v === '' || v === undefined ? undefined : v)),
  })
  .refine(
    (data) =>
      data.taxYearFileId !== undefined ||
      (data.clientId !== undefined && data.taxYear !== undefined),
    {
      message: 'Provide taxYearFileId or both clientId and taxYear',
    },
  )

export type UploadDocumentBody = z.infer<typeof UploadDocumentBodySchema>

export const UpdateDocumentBodySchema = z
  .object({
    category: DocumentCategorySchema.optional(),
    status: DocumentStatusSchema.optional(),
    processingStatus: DocumentProcessingStatusSchema.optional(),
    extractionStatus: DocumentExtractionStatusSchema.optional(),
    reviewStatus: DocumentReviewStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

export type UpdateDocumentBody = z.infer<typeof UpdateDocumentBodySchema>

export const DocumentSummarySchema = z.object({
  id: UuidSchema,
  clientId: UuidSchema,
  taxYearFileId: UuidSchema,
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  category: DocumentCategorySchema,
  status: DocumentStatusSchema,
  processingStatus: DocumentProcessingStatusSchema,
  extractionStatus: DocumentExtractionStatusSchema,
  reviewStatus: DocumentReviewStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const DocumentDetailSchema = DocumentSummarySchema.extend({
  documentType: z.string().nullable(),
  confidence: z.number().nullable(),
  uploadedById: UuidSchema.nullable(),
  previousVersionId: UuidSchema.nullable(),
  extractedFields: z.unknown().nullable(),
  taxYear: TaxYearSchema.nullable(),
  verifiedAt: z.string().datetime().nullable(),
  verifiedById: UuidSchema.nullable(),
})

export const DocumentVersionSummarySchema = DocumentSummarySchema.pick({
  id: true,
  originalName: true,
  version: true,
  status: true,
  processingStatus: true,
  createdAt: true,
  sizeBytes: true,
  mimeType: true,
})

export const DocumentVersionsResponseSchema = z.object({
  items: z.array(DocumentVersionSummarySchema),
})

export const PaginatedDocumentsSchema = z.object({
  items: z.array(DocumentSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export const SignedDownloadUrlSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
})
