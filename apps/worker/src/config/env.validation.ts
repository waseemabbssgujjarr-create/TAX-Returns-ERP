import { z } from 'zod'

function assertBase64MinBytes(value: string, minBytes: number): boolean {
  try {
    const decoded = Buffer.from(value, 'base64')
    return decoded.length >= minBytes
  } catch {
    return false
  }
}

function assertBase64ExactBytes(value: string, exactBytes: number): boolean {
  try {
    const decoded = Buffer.from(value, 'base64')
    return decoded.length === exactBytes
  } catch {
    return false
  }
}

const envSchema = z
  .object({
    // Database
    DATABASE_URL: z.string().url(),
    DATABASE_MIGRATIONS_URL: z.string().url().optional(),
    DATABASE_DIRECT_URL: z.string().url().optional(),

    // Redis — production (Upstash): REDIS_URL=rediss://default:PASSWORD@HOST:6379
    // Local dev fallback: REDIS_HOST + REDIS_PORT when REDIS_URL is unset.
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),

    // Storage driver — local (dev/E2E only) | s3 (MinIO) | google-drive (production).
    STORAGE_DRIVER: z.enum(['local', 's3', 'google-drive']).default('local'),

    // S3/MinIO — only required when STORAGE_DRIVER=s3 (not mandatory in production;
    // production uses google-drive instead — see superRefine below).
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_SIGNED_URL_EXPIRY: z.coerce.number().default(900),

    // Google Drive OAuth — only required when STORAGE_DRIVER=google-drive.
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
    WORKER_PUBLIC_URL: z.string().url().optional(),

    // Auth — JWT
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),

    // OpenAI — optional in dev/test for unit tests that do not call AI
    OPENAI_API_KEY: z.string().default(''),
    OPENAI_EXTRACTION_MODEL: z.string().default('gpt-4o'),
    OPENAI_CLASSIFICATION_MODEL: z.string().default('gpt-4o-mini'),

    // Encryption & OTP HMAC
    ENCRYPTION_MASTER_KEY: z
      .string()
      .refine(
        (v) => assertBase64ExactBytes(v, 32),
        'ENCRYPTION_MASTER_KEY must be valid base64 decoding to exactly 32 bytes',
      ),
    OTP_CONTACT_SECRET: z
      .string()
      .refine(
        (v) => assertBase64MinBytes(v, 32),
        'OTP_CONTACT_SECRET must be valid base64 decoding to at least 32 bytes',
      ),

    // App
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    WORKER_PORT: z.coerce.number().default(3001),
  })
  .superRefine((data, ctx) => {
    // Migrations URLs are deployment-only (prisma migrate / cpanel:build), not worker runtime.
    if (data.NODE_ENV === 'production' && !data.REDIS_URL?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REDIS_URL is required in production (e.g. Upstash rediss:// URL for BullMQ)',
        path: ['REDIS_URL'],
      })
    }

    if (data.NODE_ENV === 'production' && data.OPENAI_API_KEY.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPENAI_API_KEY is required in production',
        path: ['OPENAI_API_KEY'],
      })
    }

    // Production MUST use Google Drive per-user storage — local disk is dev/E2E-only
    // (not durable, not shared across instances) and S3/MinIO is no longer required.
    if (data.NODE_ENV === 'production' && data.STORAGE_DRIVER !== 'google-drive') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STORAGE_DRIVER must be "google-drive" in production',
        path: ['STORAGE_DRIVER'],
      })
    }

    if (data.STORAGE_DRIVER === 's3') {
      for (const key of [
        'S3_ENDPOINT',
        'S3_REGION',
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ] as const) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required when STORAGE_DRIVER=s3`,
            path: [key],
          })
        }
      }
    }

    if (data.STORAGE_DRIVER === 'google-drive') {
      for (const key of [
        'GOOGLE_OAUTH_CLIENT_ID',
        'GOOGLE_OAUTH_CLIENT_SECRET',
        'GOOGLE_OAUTH_REDIRECT_URI',
        'WORKER_PUBLIC_URL',
      ] as const) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required when STORAGE_DRIVER=google-drive`,
            path: [key],
          })
        }
      }
    }
  })

export type WorkerEnv = z.infer<typeof envSchema>

/**
 * Validates all required environment variables at startup.
 * Throws with a clear message listing every missing/invalid variable.
 */
export function validateEnv(): WorkerEnv {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Worker startup failed — invalid environment variables:\n${issues}`)
  }

  return result.data
}

/** Resolved migrations connection URL (migrations role only — not for runtime NestJS). */
export function resolveDatabaseMigrationsUrl(env: WorkerEnv): string {
  return env.DATABASE_MIGRATIONS_URL ?? env.DATABASE_DIRECT_URL ?? ''
}
