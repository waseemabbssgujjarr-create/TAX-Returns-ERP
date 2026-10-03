import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'

import {
  clearRlsSession,
  createAppClient,
  createMigrationsClient,
  probeIntegrationDatabase,
  seedTwoFirmsFixture,
  teardownTwoFirmsFixture,
  withAppRls,
  type RlsSession,
  type TwoFirmSeed,
} from './test-db'

const probe = await probeIntegrationDatabase()

describe.skipIf(!probe.ok)('RLS integration (Phase 1)', () => {
  let app!: PrismaClient
  let migrations!: PrismaClient
  let seed!: TwoFirmSeed
  let staffA!: RlsSession

  beforeAll(async () => {
    app = createAppClient()
    const mig = createMigrationsClient()
    if (!mig) {
      throw new Error('DATABASE_MIGRATIONS_URL is not set')
    }
    migrations = mig
    seed = await seedTwoFirmsFixture(migrations, 'rls')
    staffA = {
      firmId: seed.firmAId,
      userId: seed.userAId,
      sessionType: 'staff',
    }
  })

  afterAll(async () => {
    await teardownTwoFirmsFixture(migrations, seed)
    await app.$disconnect()
    await migrations.$disconnect()
  })

  describe('users', () => {
    it('correct firm context sees own rows', async () => {
      const rows = await withAppRls(app, staffA, (tx) =>
        tx.user.findMany({ where: { firmId: seed.firmAId } }),
      )
      expect(rows.some((r) => r.id === seed.userAId)).toBe(true)
    })

    it('wrong firm context sees zero rows from other firm (IC-1)', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.user.findUnique({ where: { id: seed.userBId } }),
      )
      expect(row).toBeNull()
    })

    it('missing firm context returns zero rows (IC-2)', async () => {
      const count = await app.$transaction(async (tx) => {
        await clearRlsSession(tx)
        return tx.user.count()
      })
      expect(count).toBe(0)
    })
  })

  describe('clients (staff)', () => {
    it('correct firm context sees firm clients', async () => {
      const rows = await withAppRls(app, staffA, (tx) => tx.client.findMany())
      expect(rows.map((r) => r.id).sort()).toEqual([seed.clientA1Id, seed.clientA2Id].sort())
    })

    it('wrong firm context sees zero rows from other firm', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.client.findUnique({ where: { id: seed.clientB1Id } }),
      )
      expect(row).toBeNull()
    })

    it('missing firm context returns zero rows (IC-2)', async () => {
      const count = await app.$transaction(async (tx) => {
        await clearRlsSession(tx)
        return tx.client.count()
      })
      expect(count).toBe(0)
    })
  })

  describe('clients (portal)', () => {
    it('portal correct client sees only that client', async () => {
      const session: RlsSession = {
        firmId: seed.firmAId,
        userId: seed.userAId,
        sessionType: 'portal',
        clientId: seed.clientA1Id,
      }
      const rows = await withAppRls(app, session, (tx) => tx.client.findMany())
      expect(rows).toHaveLength(1)
      expect(rows[0]?.id).toBe(seed.clientA1Id)
    })

    it('portal wrong client sees zero rows for other client in same firm', async () => {
      const session: RlsSession = {
        firmId: seed.firmAId,
        userId: seed.userAId,
        sessionType: 'portal',
        clientId: seed.clientA1Id,
      }
      const row = await withAppRls(app, session, (tx) =>
        tx.client.findUnique({ where: { id: seed.clientA2Id } }),
      )
      expect(row).toBeNull()
    })
  })

  describe('refresh_tokens', () => {
    it('correct firm + user context sees own token row', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.refreshToken.findUnique({ where: { id: seed.refreshAId } }),
      )
      expect(row?.id).toBe(seed.refreshAId)
    })

    it('wrong firm context sees zero rows from other firm', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.refreshToken.findUnique({ where: { id: seed.refreshBId } }),
      )
      expect(row).toBeNull()
    })

    it('missing firm context returns zero rows (IC-2)', async () => {
      const count = await app.$transaction(async (tx) => {
        await clearRlsSession(tx)
        return tx.refreshToken.count()
      })
      expect(count).toBe(0)
    })
  })

  describe('otp_codes', () => {
    it('correct firm context sees own otp rows', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.otpCode.findUnique({ where: { id: seed.otpAId } }),
      )
      expect(row?.id).toBe(seed.otpAId)
    })

    it('wrong firm context sees zero rows from other firm', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.otpCode.findUnique({ where: { id: seed.otpBId } }),
      )
      expect(row).toBeNull()
    })

    it('missing firm context returns zero rows (IC-2)', async () => {
      const count = await app.$transaction(async (tx) => {
        await clearRlsSession(tx)
        return tx.otpCode.count()
      })
      expect(count).toBe(0)
    })
  })

  describe('audit_logs', () => {
    it('correct firm context sees own audit rows', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.auditLog.findUnique({ where: { id: seed.auditAId } }),
      )
      expect(row?.id).toBe(seed.auditAId)
    })

    it('wrong firm context sees zero rows from other firm', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.auditLog.findUnique({ where: { id: seed.auditBId } }),
      )
      expect(row).toBeNull()
    })

    it('missing firm context returns zero rows (IC-2)', async () => {
      const count = await app.$transaction(async (tx) => {
        await clearRlsSession(tx)
        return tx.auditLog.count()
      })
      expect(count).toBe(0)
    })
  })

  describe('documents (portal isolation)', () => {
    let docA1Id = ''
    let docA2Id = ''

    beforeAll(async () => {
      await withAppRls(app, staffA, async (tx) => {
        const tyf1 = await tx.taxYearFile.create({
          data: { clientId: seed.clientA1Id, taxYear: 2024 },
        })
        const tyf2 = await tx.taxYearFile.create({
          data: { clientId: seed.clientA2Id, taxYear: 2024 },
        })
        const d1 = await tx.document.create({
          data: {
            firmId: seed.firmAId,
            clientId: seed.clientA1Id,
            taxYearFileId: tyf1.id,
            originalName: 'a1.pdf',
            storageKey: `test/${seed.firmAId}/a1-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 12,
          },
        })
        const d2 = await tx.document.create({
          data: {
            firmId: seed.firmAId,
            clientId: seed.clientA2Id,
            taxYearFileId: tyf2.id,
            originalName: 'a2.pdf',
            storageKey: `test/${seed.firmAId}/a2-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 12,
          },
        })
        docA1Id = d1.id
        docA2Id = d2.id
      })
    })

    it('portal client A1 sees only own documents', async () => {
      const rows = await withAppRls(
        app,
        {
          firmId: seed.firmAId,
          userId: seed.userAId,
          sessionType: 'portal',
          clientId: seed.clientA1Id,
        },
        (tx) => tx.document.findMany(),
      )
      expect(rows.map((r) => r.id)).toEqual([docA1Id])
    })

    it('portal client A1 cannot read sibling client document', async () => {
      const row = await withAppRls(
        app,
        {
          firmId: seed.firmAId,
          userId: seed.userAId,
          sessionType: 'portal',
          clientId: seed.clientA1Id,
        },
        (tx) => tx.document.findUnique({ where: { id: docA2Id } }),
      )
      expect(row).toBeNull()
    })

    it('staff still sees both firm documents', async () => {
      const rows = await withAppRls(app, staffA, (tx) => tx.document.findMany())
      expect(rows.map((r) => r.id).sort()).toEqual([docA1Id, docA2Id].sort())
    })
  })

  describe('return_preparations isolation', () => {
    let prepAId = ''
    let prepBId = ''

    beforeAll(async () => {
      await withAppRls(app, staffA, async (tx) => {
        const tyf = await tx.taxYearFile.create({
          data: { clientId: seed.clientA1Id, taxYear: 2025 },
        })
        const prep = await tx.returnPreparation.create({
          data: {
            taxYearFileId: tyf.id,
            firmId: seed.firmAId,
            structuredJson: {},
            reviewStatus: 'DRAFT',
          },
        })
        prepAId = prep.id
      })

      const staffB: RlsSession = {
        firmId: seed.firmBId,
        userId: seed.userBId,
        sessionType: 'staff',
      }
      await withAppRls(app, staffB, async (tx) => {
        const tyf = await tx.taxYearFile.create({
          data: { clientId: seed.clientB1Id, taxYear: 2025 },
        })
        const prep = await tx.returnPreparation.create({
          data: {
            taxYearFileId: tyf.id,
            firmId: seed.firmBId,
            structuredJson: {},
            reviewStatus: 'DRAFT',
          },
        })
        prepBId = prep.id
      })
    })

    it('firm A staff sees own return preparation only', async () => {
      const rows = await withAppRls(app, staffA, (tx) => tx.returnPreparation.findMany())
      expect(rows.some((r) => r.id === prepAId)).toBe(true)
      expect(rows.some((r) => r.id === prepBId)).toBe(false)
    })

    it('firm A cannot read firm B return preparation (no IDOR)', async () => {
      const row = await withAppRls(app, staffA, (tx) =>
        tx.returnPreparation.findUnique({ where: { id: prepBId } }),
      )
      expect(row).toBeNull()
    })
  })
})

if (!probe.ok) {
  describe('RLS integration (Phase 1)', () => {
    it.skip(probe.reason ?? 'Postgres unavailable — skipped', () => undefined)
  })
}
