import { randomUUID } from 'node:crypto'

import { PrismaClient, type Prisma } from '@prisma/client'

export interface DbProbeResult {
  ok: boolean
  reason?: string
}

export type RlsSession = {
  firmId: string
  userId: string
  sessionType: 'staff' | 'portal'
  clientId?: string
  authFlow?: 'refresh_rotation'
}

export interface TwoFirmSeed {
  firmAId: string
  firmBId: string
  userAId: string
  userBId: string
  clientA1Id: string
  clientA2Id: string
  clientB1Id: string
  refreshAId: string
  refreshBId: string
  otpAId: string
  otpBId: string
  auditAId: string
  auditBId: string
}

const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'

export function createAppClient(): PrismaClient {
  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  return new PrismaClient({
    datasources: { db: { url } },
  })
}

export function createMigrationsClient(): PrismaClient | null {
  const url = process.env['DATABASE_MIGRATIONS_URL']
  if (!url) {
    return null
  }
  return new PrismaClient({
    datasources: { db: { url } },
  })
}

export async function probeAppDatabase(): Promise<DbProbeResult> {
  if (!process.env['DATABASE_URL']) {
    return { ok: false, reason: 'DATABASE_URL is not set (integration tests require Postgres)' }
  }
  const client = createAppClient()
  try {
    await client.$queryRaw`SELECT 1`
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: `Cannot connect with DATABASE_URL: ${String(error)}` }
  } finally {
    await client.$disconnect().catch(() => undefined)
  }
}

export async function probeIntegrationDatabase(): Promise<DbProbeResult> {
  const appProbe = await probeAppDatabase()
  if (!appProbe.ok) {
    return appProbe
  }
  const migrations = createMigrationsClient()
  if (!migrations) {
    return { ok: false, reason: 'DATABASE_MIGRATIONS_URL is not set (required for seed/cleanup)' }
  }
  try {
    await migrations.$queryRaw`SELECT 1`
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: `Cannot connect with DATABASE_MIGRATIONS_URL: ${String(error)}` }
  } finally {
    await migrations.$disconnect().catch(() => undefined)
  }
}

export async function applyRlsSession(
  tx: Prisma.TransactionClient,
  session: Partial<RlsSession> & Pick<RlsSession, 'firmId'>,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${session.firmId}, true)`
  if (session.userId !== undefined) {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${session.userId}, true)`
  }
  if (session.sessionType !== undefined) {
    await tx.$executeRaw`SELECT set_config('app.session_type', ${session.sessionType}, true)`
  }
  if (session.clientId !== undefined) {
    await tx.$executeRaw`SELECT set_config('app.current_client_id', ${session.clientId}, true)`
  }
  if (session.authFlow !== undefined) {
    await tx.$executeRaw`SELECT set_config('app.auth_flow', ${session.authFlow}, true)`
  }
}

export async function clearRlsSession(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${''}, true)`
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${''}, true)`
  await tx.$executeRaw`SELECT set_config('app.session_type', ${''}, true)`
  await tx.$executeRaw`SELECT set_config('app.current_client_id', ${''}, true)`
  await tx.$executeRaw`SELECT set_config('app.auth_flow', ${''}, true)`
}

export async function withAppRls<T>(
  client: PrismaClient,
  session: RlsSession,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await applyRlsSession(tx, session)
    return fn(tx)
  })
}

export async function withMigrationsRls<T>(
  client: PrismaClient,
  firmId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${firmId}, true)`
    return fn(tx)
  })
}

export async function withMigrationsRlsSession<T>(
  client: PrismaClient,
  session: RlsSession,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await applyRlsSession(tx, session)
    return fn(tx)
  })
}

export function uniqueTestSlug(prefix: string): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
  return `${prefix}-${suffix}`.toLowerCase().slice(0, 60)
}

export async function countFirmDirectoryOrphans(client: PrismaClient): Promise<number> {
  const rows = await client.$queryRaw<Array<{ firm_id: string }>>`
    SELECT fd.firm_id
    FROM firm_directory fd
    LEFT JOIN firms f ON f.id = fd.firm_id
    WHERE f.id IS NULL
  `
  return rows.length
}

export async function seedTwoFirmsFixture(
  migrations: PrismaClient,
  tag: string,
): Promise<TwoFirmSeed> {
  const firmAId = randomUUID()
  const firmBId = randomUUID()
  const userAId = randomUUID()
  const userBId = randomUUID()
  const clientA1Id = randomUUID()
  const clientA2Id = randomUUID()
  const clientB1Id = randomUUID()
  const refreshAId = randomUUID()
  const refreshBId = randomUUID()
  const otpAId = randomUUID()
  const otpBId = randomUUID()
  const auditAId = randomUUID()
  const auditBId = randomUUID()

  const slugA = uniqueTestSlug(`${tag}-a`)
  const slugB = uniqueTestSlug(`${tag}-b`)
  const expiresAt = new Date(Date.now() + 86_400_000)

  await withMigrationsRls(migrations, firmAId, async (tx) => {
    await tx.firm.create({
      data: {
        id: firmAId,
        name: `RLS Firm A ${tag}`,
        slug: slugA,
        updatedAt: new Date(),
      },
    })
  })

  await withMigrationsRls(migrations, firmBId, async (tx) => {
    await tx.firm.create({
      data: {
        id: firmBId,
        name: `RLS Firm B ${tag}`,
        slug: slugB,
        updatedAt: new Date(),
      },
    })
  })

  await withMigrationsRlsSession(
    migrations,
    {
      firmId: firmAId,
      userId: userAId,
      sessionType: 'staff',
    },
    async (tx) => {
      await tx.user.create({
        data: {
          id: userAId,
          firmId: firmAId,
          email: `${tag}-a-owner@rls.test`,
          passwordHash: DUMMY_HASH,
          name: 'Owner A',
          role: 'OWNER',
          updatedAt: new Date(),
        },
      })
      await tx.client.createMany({
        data: [
          {
            id: clientA1Id,
            firmId: firmAId,
            type: 'SALARIED_INDIVIDUAL',
            displayName: 'Client A1',
            updatedAt: new Date(),
          },
          {
            id: clientA2Id,
            firmId: firmAId,
            type: 'SALARIED_INDIVIDUAL',
            displayName: 'Client A2',
            updatedAt: new Date(),
          },
        ],
      })
      await tx.refreshToken.create({
        data: {
          id: refreshAId,
          firmId: firmAId,
          userId: userAId,
          tokenHash: `hash-a-${tag}-${randomUUID()}`,
          jwtFamily: randomUUID(),
          expiresAt,
        },
      })
      await tx.otpCode.create({
        data: {
          id: otpAId,
          firmId: firmAId,
          contactHmac: `hmac-a-${tag}`,
          channel: 'email',
          otpHash: DUMMY_HASH,
          expiresAt,
        },
      })
      await tx.auditLog.create({
        data: {
          id: auditAId,
          firmId: firmAId,
          userId: userAId,
          action: 'test.seed',
        },
      })
    },
  )

  await withMigrationsRlsSession(
    migrations,
    {
      firmId: firmBId,
      userId: userBId,
      sessionType: 'staff',
    },
    async (tx) => {
      await tx.user.create({
        data: {
          id: userBId,
          firmId: firmBId,
          email: `${tag}-b-owner@rls.test`,
          passwordHash: DUMMY_HASH,
          name: 'Owner B',
          role: 'OWNER',
          updatedAt: new Date(),
        },
      })
      await tx.client.create({
        data: {
          id: clientB1Id,
          firmId: firmBId,
          type: 'SALARIED_INDIVIDUAL',
          displayName: 'Client B1',
          updatedAt: new Date(),
        },
      })
      await tx.refreshToken.create({
        data: {
          id: refreshBId,
          firmId: firmBId,
          userId: userBId,
          tokenHash: `hash-b-${tag}-${randomUUID()}`,
          jwtFamily: randomUUID(),
          expiresAt,
        },
      })
      await tx.otpCode.create({
        data: {
          id: otpBId,
          firmId: firmBId,
          contactHmac: `hmac-b-${tag}`,
          channel: 'email',
          otpHash: DUMMY_HASH,
          expiresAt,
        },
      })
      await tx.auditLog.create({
        data: {
          id: auditBId,
          firmId: firmBId,
          userId: userBId,
          action: 'test.seed',
        },
      })
    },
  )

  return {
    firmAId,
    firmBId,
    userAId,
    userBId,
    clientA1Id,
    clientA2Id,
    clientB1Id,
    refreshAId,
    refreshBId,
    otpAId,
    otpBId,
    auditAId,
    auditBId,
  }
}

export async function teardownFirm(migrations: PrismaClient, firmId: string): Promise<void> {
  // Must set session_type=staff so clients RLS policy allows DELETE.
  await withMigrationsRlsSession(
    migrations,
    { firmId, userId: '00000000-0000-0000-0000-000000000001', sessionType: 'staff' },
    async (tx) => {
      await tx.auditLog.deleteMany({ where: { firmId } })
      await tx.refreshToken.deleteMany({ where: { firmId } })
      await tx.recoveryCode.deleteMany({ where: { firmId } })
      await tx.otpCode.deleteMany({ where: { firmId } })
      await tx.clientNote.deleteMany({ where: { firmId } })
      await tx.clientAccess.deleteMany({
        where: { client: { firmId } },
      })
      await tx.document.deleteMany({ where: { firmId } })
      await tx.taxYearFile.deleteMany({ where: { client: { firmId } } })
      await tx.client.deleteMany({ where: { firmId } })
      await tx.user.deleteMany({ where: { firmId } })
      await tx.firm.delete({ where: { id: firmId } })
    },
  )
}

export async function teardownTwoFirmsFixture(
  migrations: PrismaClient,
  seed: TwoFirmSeed,
): Promise<void> {
  await teardownFirm(migrations, seed.firmAId)
  await teardownFirm(migrations, seed.firmBId)
}
