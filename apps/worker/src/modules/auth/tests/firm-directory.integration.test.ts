import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'

import { TenantBootstrapService } from '../tenant-bootstrap.service'

import {
  createAppClient,
  createMigrationsClient,
  probeIntegrationDatabase,
  teardownFirm,
  uniqueTestSlug,
  withMigrationsRls,
} from './test-db'

const probe = await probeIntegrationDatabase()

describe.skipIf(!probe.ok)('FirmDirectory sync integration (Phase 1)', () => {
  let app!: PrismaClient
  let migrations!: PrismaClient
  const firmIds: string[] = []

  beforeAll(async () => {
    app = createAppClient()
    const mig = createMigrationsClient()
    if (!mig) {
      throw new Error('DATABASE_MIGRATIONS_URL is not set')
    }
    migrations = mig
    // Under FORCE RLS, a bare SELECT FROM firms hides every row — a NOT EXISTS
    // orphan wipe would delete the entire firm_directory (including demo seed).
    // Only remove directory rows whose firm is confirmed missing under that firm's RLS context.
    const dirs = await migrations.firmDirectory.findMany()
    for (const row of dirs) {
      const firm = await withMigrationsRls(migrations, row.firmId, (tx) =>
        tx.firm.findUnique({ where: { id: row.firmId }, select: { id: true } }),
      )
      if (!firm) {
        await migrations.firmDirectory.delete({ where: { firmId: row.firmId } })
      }
    }
  })

  afterAll(async () => {
    for (const firmId of firmIds) {
      await teardownFirm(migrations, firmId).catch(() => undefined)
    }
    await app.$disconnect()
    await migrations.$disconnect()
  })

  async function createFirm(slug: string): Promise<string> {
    const firmId = randomUUID()
    firmIds.push(firmId)
    await withMigrationsRls(migrations, firmId, async (tx) => {
      await tx.firm.create({
        data: {
          id: firmId,
          name: `Directory test ${slug}`,
          slug,
          updatedAt: new Date(),
        },
      })
    })
    return firmId
  }

  it('creating a firm inserts a matching firm_directory row', async () => {
    const slug = uniqueTestSlug('fd-create')
    const firmId = await createFirm(slug)

    const row = await app.firmDirectory.findUnique({ where: { firmId } })
    expect(row).not.toBeNull()
    expect(row?.slug).toBe(slug)
    expect(row?.isActive).toBe(true)
  })

  it('updating firm slug updates firm_directory', async () => {
    const slug = uniqueTestSlug('fd-slug')
    const firmId = await createFirm(slug)
    const newSlug = uniqueTestSlug('fd-slug-new')

    await withMigrationsRls(migrations, firmId, async (tx) => {
      await tx.firm.update({
        where: { id: firmId },
        data: { slug: newSlug },
      })
    })

    const row = await app.firmDirectory.findUnique({ where: { firmId } })
    expect(row?.slug).toBe(newSlug)
    const old = await app.firmDirectory.findFirst({ where: { slug } })
    expect(old).toBeNull()
  })

  it('updating a firm recreates a missing firm_directory row (upsert)', async () => {
    const slug = uniqueTestSlug('fd-repair')
    const firmId = await createFirm(slug)

    await migrations.firmDirectory.delete({ where: { firmId } })
    expect(await app.firmDirectory.findUnique({ where: { firmId } })).toBeNull()

    await withMigrationsRls(migrations, firmId, async (tx) => {
      await tx.firm.update({
        where: { id: firmId },
        data: { isActive: true },
      })
    })

    const row = await app.firmDirectory.findUnique({ where: { firmId } })
    expect(row).not.toBeNull()
    expect(row?.slug).toBe(slug)
    expect(row?.isActive).toBe(true)
  })

  it('deactivating a firm sets firm_directory.is_active false and bootstrap skips it', async () => {
    const slug = uniqueTestSlug('fd-off')
    const firmId = await createFirm(slug)

    await withMigrationsRls(migrations, firmId, async (tx) => {
      await tx.firm.update({
        where: { id: firmId },
        data: { isActive: false },
      })
    })

    const row = await app.firmDirectory.findUnique({ where: { firmId } })
    expect(row?.isActive).toBe(false)

    const bootstrap = new TenantBootstrapService()
    await expect(bootstrap.resolveFirm(slug)).resolves.toBeNull()
    await bootstrap.onModuleDestroy()
  })

  it('deleting a firm removes the firm_directory row', async () => {
    const slug = uniqueTestSlug('fd-del')
    const firmId = await createFirm(slug)

    await teardownFirm(migrations, firmId)
    firmIds.splice(firmIds.indexOf(firmId), 1)

    const row = await app.firmDirectory.findUnique({ where: { firmId } })
    expect(row).toBeNull()
  })

  it('duplicate slug is rejected by the database', async () => {
    const slug = uniqueTestSlug('fd-dup')
    await createFirm(slug)

    const secondId = randomUUID()
    firmIds.push(secondId)
    await expect(
      withMigrationsRls(migrations, secondId, async (tx) => {
        await tx.firm.create({
          data: {
            id: secondId,
            name: 'Duplicate slug firm',
            slug,
            updatedAt: new Date(),
          },
        })
      }),
    ).rejects.toThrow()
  })

  it('orphan detection query returns zero rows', async () => {
    // Under FORCE RLS, a bare LEFT JOIN firms from migrations role also hides firms
    // without session context. Verify each directory row by establishing firm context.
    const dirs = await migrations.firmDirectory.findMany()
    for (const row of dirs) {
      const firm = await withMigrationsRls(migrations, row.firmId, (tx) =>
        tx.firm.findUnique({ where: { id: row.firmId }, select: { id: true } }),
      )
      expect(firm).not.toBeNull()
    }
  })

  it('direct INSERT into firm_directory as taxdesk_app is denied', async () => {
    const ghostId = randomUUID()
    const slug = uniqueTestSlug('fd-deny')

    await expect(
      app.$executeRaw`
        INSERT INTO firm_directory (firm_id, slug, is_active)
        VALUES (${ghostId}::text, ${slug}, true)
      `,
    ).rejects.toMatchObject({
      message: expect.stringMatching(/permission denied|42501/i),
    })
  })
})

if (!probe.ok) {
  describe('FirmDirectory sync integration (Phase 1)', () => {
    it.skip(probe.reason ?? 'Postgres unavailable — skipped', () => undefined)
  })
}
