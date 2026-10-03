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

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),

    // Storage
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string(),
    S3_BUCKET: z.string(),
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
    S3_SIGNED_URL_EXPIRY: z.coerce.number().default(900),

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
    if (!data.DATABASE_MIGRATIONS_URL && !data.DATABASE_DIRECT_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DATABASE_MIGRATIONS_URL or DATABASE_DIRECT_URL is required',
        path: ['DATABASE_MIGRATIONS_URL'],
      })
    }

    if (data.NODE_ENV === 'production' && data.OPENAI_API_KEY.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPENAI_API_KEY is required in production',
        path: ['OPENAI_API_KEY'],
      })
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
