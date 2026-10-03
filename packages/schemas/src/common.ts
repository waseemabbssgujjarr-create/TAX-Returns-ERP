import { z } from 'zod'

/**
 * Shared primitive validators used across all schemas.
 */

// ── Pakistan-specific identifiers ─────────────────────────────────────────────

/** Treat blank form values as absent optional fields. */
export function emptyStringToUndefined(val: unknown): unknown {
  if (val === null || val === undefined) return undefined
  if (typeof val === 'string' && val.trim() === '') return undefined
  return val
}

/** Stable Zod/API message — map to i18n in the web app. */
export const CNIC_MUST_BE_13_DIGITS = 'CNIC must be 13 digits'

/** NTN digit-count message — map to i18n in the web app. */
export const NTN_MUST_BE_7_DIGITS = 'NTN must be 7 digits'

/** CNIC: 13 digits in format XXXXX-XXXXXXX-X (accepts dashed or 13-digit input) */
export const CnicSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      const digits = val.replace(/\D/g, '')
      return digits.length === 13
    },
    { message: CNIC_MUST_BE_13_DIGITS },
  )
  .transform((val) => {
    const digits = val.replace(/\D/g, '')
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
  })

/** NTN: 7 digits (non-digits stripped, e.g. dashes or spaces) */
export const NtnSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{7}$/, NTN_MUST_BE_7_DIGITS))

/** Pakistan phone number: +92 followed by 10 digits */
export const PakistanPhoneSchema = z
  .string()
  .regex(/^\+92\d{10}$/, 'Phone must be in format +92XXXXXXXXXX')

// ── Money ─────────────────────────────────────────────────────────────────────

/**
 * Paisa amount as a BigInt-compatible string for JSON serialization.
 * JSON does not support BigInt natively so we use string representation.
 * Parse to BigInt in application code.
 */
export const PaisaStringSchema = z
  .string()
  .regex(/^\d+$/, 'Paisa must be a non-negative integer string')
  .describe('Monetary amount in paisa (1 PKR = 100 paisa). BigInt serialized as string.')

/** Paisa as a number (for use in API responses where BigInt is not needed) */
export const PaisaNumberSchema = z.number().int().nonnegative().describe('Monetary amount in paisa')

// ── Dates ─────────────────────────────────────────────────────────────────────

/** ISO 8601 date string (YYYY-MM-DD) */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in ISO format YYYY-MM-DD')

/** Tax year as a 4-digit integer (e.g. 2025 = year ending 30 June 2025) */
export const TaxYearSchema = z
  .number()
  .int()
  .min(2020)
  .max(2099)
  .describe('Tax year — e.g. 2025 means the year ending 30 June 2025')

// ── Locale ────────────────────────────────────────────────────────────────────

export const LocaleSchema = z.enum(['en', 'ur'])
export type Locale = z.infer<typeof LocaleSchema>

// ── UUID ─────────────────────────────────────────────────────────────────────

export const UuidSchema = z.string().uuid()

// ── Pagination ───────────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalPages: z.number().int().nonnegative(),
  })
}
