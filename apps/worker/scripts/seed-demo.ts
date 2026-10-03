/**
 * Deterministic, idempotent demo seed for local development and Playwright E2E.
 *
 * SAFETY:
 * - Refuses to run when NODE_ENV=production
 * - Never logs passwords, TOTP secrets, recovery codes, or tokens
 * - Credentials come only from env (see .env.e2e.example)
 *
 * Usage:
 *   pnpm db:seed:demo
 *
 * Requires DATABASE_MIGRATIONS_URL (or DATABASE_URL with migrations role),
 * ENCRYPTION_MASTER_KEY, and SEED_* / E2E_TOTP_SECRET from env.
 */

import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PrismaClient, UserRole, ClientType } from '@prisma/client'
import bcrypt from 'bcrypt'
import { authenticator } from 'otplib'

import { LocalKmsAdapter, decodeMasterKeyFromEnv } from '../src/modules/kms/local-kms.adapter'

/** Load repo-root .env then .env.e2e.local (never log values). */
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
loadEnvFile(path.join(repoRoot, '.env'))
loadEnvFile(path.join(repoRoot, '.env.e2e.local'))

const BCRYPT_PASSWORD_COST = 12

/** Fixed UUIDs — idempotent upserts across re-runs */
const DEMO_FIRM_ID = '11111111-1111-4111-8111-111111111111'
const DEMO_USER_ID = '22222222-2222-4222-8222-222222222222'
const DEMO_CLIENT_ID = '33333333-3333-4333-8333-333333333333'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Missing required env ${name}. Copy .env.e2e.example → .env.e2e.local and fill values, then: pnpm db:seed:demo`,
    )
  }
  return value
}

async function withFirmRls<T>(
  prisma: PrismaClient,
  firmId: string,
  userId: string,
  fn: (
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
  ) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${firmId}, true)`
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`
    await tx.$executeRaw`SELECT set_config('app.session_type', ${'staff'}, true)`
    return fn(tx)
  })
}

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('db:seed:demo refuses to run when NODE_ENV=production')
  }

  const migrationsUrl = process.env['DATABASE_MIGRATIONS_URL'] ?? process.env['DATABASE_DIRECT_URL']
  if (!migrationsUrl) {
    throw new Error('DATABASE_MIGRATIONS_URL is required for seeding (table-owner role)')
  }

  const firmSlug = requireEnv('SEED_FIRM_SLUG').toLowerCase()
  const staffEmail = requireEnv('SEED_STAFF_EMAIL').toLowerCase()
  const staffPassword = requireEnv('SEED_STAFF_PASSWORD')
  const staffName = process.env['SEED_STAFF_NAME']?.trim() || 'Demo Owner'
  const totpSecret = requireEnv('E2E_TOTP_SECRET')
  const masterKeyB64 = requireEnv('ENCRYPTION_MASTER_KEY')

  // Validate TOTP secret is usable without echoing it
  try {
    authenticator.check('000000', totpSecret)
  } catch {
    throw new Error('E2E_TOTP_SECRET must be a valid base32 TOTP secret')
  }
  // Generate once to ensure secret works (discard code — do not log)
  void authenticator.generate(totpSecret)

  const kms = new LocalKmsAdapter(decodeMasterKeyFromEnv(masterKeyB64))
  const prisma = new PrismaClient({
    datasources: { db: { url: migrationsUrl } },
  })

  try {
    const passwordHash = await bcrypt.hash(staffPassword, BCRYPT_PASSWORD_COST)

    // Firm (trigger syncs firm_directory)
    await withFirmRls(prisma, DEMO_FIRM_ID, DEMO_USER_ID, async (tx) => {
      const existing = await tx.firm.findUnique({ where: { id: DEMO_FIRM_ID } })
      if (!existing) {
        const { plaintext, wrapped } = await kms.generateDataKey()
        await tx.firm.create({
          data: {
            id: DEMO_FIRM_ID,
            name: 'Demo Tax Associates',
            slug: firmSlug,
            isActive: true,
            idleTimeoutMinutes: 30,
            encryptedDataKey: wrapped,
            updatedAt: new Date(),
          },
        })
        plaintext.fill(0)
      } else {
        await tx.firm.update({
          where: { id: DEMO_FIRM_ID },
          data: {
            name: 'Demo Tax Associates',
            slug: firmSlug,
            isActive: true,
            idleTimeoutMinutes: 30,
          },
        })
      }

      // Ensure bootstrap directory row exists (trigger upserts; seed must not
      // proceed if firm_directory is still missing — login would 401).
      const directory = await tx.firmDirectory.findUnique({
        where: { firmId: DEMO_FIRM_ID },
      })
      if (!directory || directory.slug !== firmSlug || !directory.isActive) {
        throw new Error(
          `firm_directory missing/stale for demo firm after upsert (slug=${firmSlug}). ` +
            'Apply migration 20251002120000_firm_directory_upsert_sync and re-run seed.',
        )
      }

      let wrappedKey = (
        await tx.firm.findUnique({
          where: { id: DEMO_FIRM_ID },
          select: { encryptedDataKey: true },
        })
      )?.encryptedDataKey

      if (!wrappedKey) {
        const { plaintext, wrapped } = await kms.generateDataKey()
        wrappedKey = wrapped
        await tx.firm.update({
          where: { id: DEMO_FIRM_ID },
          data: { encryptedDataKey: wrapped },
        })
        plaintext.fill(0)
      }

      const dataKey = await kms.unwrapDataKey(wrappedKey)
      const totpCiphertext = await kms.encryptWithDataKey(dataKey, Buffer.from(totpSecret, 'utf8'))
      dataKey.fill(0)

      const user = await tx.user.findUnique({ where: { id: DEMO_USER_ID } })
      if (!user) {
        await tx.user.create({
          data: {
            id: DEMO_USER_ID,
            firmId: DEMO_FIRM_ID,
            email: staffEmail,
            passwordHash,
            name: staffName,
            role: UserRole.OWNER,
            totpEnabled: true,
            totpSecret: totpCiphertext,
            totpVerifiedAt: new Date(),
            isActive: true,
            failedLoginCount: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
            updatedAt: new Date(),
          },
        })
      } else {
        await tx.user.update({
          where: { id: DEMO_USER_ID },
          data: {
            email: staffEmail,
            passwordHash,
            name: staffName,
            role: UserRole.OWNER,
            totpEnabled: true,
            totpSecret: totpCiphertext,
            totpSetupPendingSecret: null,
            totpVerifiedAt: new Date(),
            isActive: true,
            failedLoginCount: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
          },
        })
      }

      const client = await tx.client.findUnique({ where: { id: DEMO_CLIENT_ID } })
      if (!client) {
        await tx.client.create({
          data: {
            id: DEMO_CLIENT_ID,
            firmId: DEMO_FIRM_ID,
            type: ClientType.SALARIED_INDIVIDUAL,
            displayName: 'Demo Portal Client',
            updatedAt: new Date(),
          },
        })
      }

      await tx.clientAccess.upsert({
        where: {
          clientId_userId: { clientId: DEMO_CLIENT_ID, userId: DEMO_USER_ID },
        },
        create: {
          id: randomUUID(),
          clientId: DEMO_CLIENT_ID,
          userId: DEMO_USER_ID,
        },
        update: {},
      })
    })

    // Fingerprint only — never secrets
    const fingerprint = createHash('sha256')
      .update(`${firmSlug}|${staffEmail}|totp-configured`)
      .digest('hex')
      .slice(0, 12)

    // Structured success without secrets
    process.stdout.write(
      JSON.stringify({
        ok: true,
        seed: 'demo',
        firmId: DEMO_FIRM_ID,
        userId: DEMO_USER_ID,
        clientId: DEMO_CLIENT_ID,
        firmSlug,
        staffEmail,
        totpEnabled: true,
        fingerprint,
      }) + '\n',
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  // Never dump env or stack secrets
  process.stderr.write(`seed-demo failed: ${message}\n`)
  process.exit(1)
})
