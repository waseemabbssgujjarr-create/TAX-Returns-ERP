import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

const SLUG_PATTERN = /^[a-z0-9-]{2,60}$/

export interface ResolvedFirm {
  firmId: string
  idleTimeoutMinutes: number
}

/**
 * Pre-auth firm resolution via firm_directory only (INV-4 — dedicated bootstrap client).
 */
@Injectable()
export class TenantBootstrapService implements OnModuleDestroy {
  private readonly prismaBootstrap = new PrismaClient({
    datasources: {
      db: {
        ...(process.env['DATABASE_URL'] !== undefined ? { url: process.env['DATABASE_URL'] } : {}),
      },
    },
  })

  async onModuleDestroy(): Promise<void> {
    await this.prismaBootstrap.$disconnect()
  }

  async resolveFirm(slug: string): Promise<ResolvedFirm | null> {
    const canonical = slug.toLowerCase().trim()
    if (!SLUG_PATTERN.test(canonical)) {
      return null
    }

    const rows = await this.prismaBootstrap.$queryRaw<
      Array<{ firm_id: string; is_active: boolean }>
    >`SELECT firm_id, is_active FROM firm_directory WHERE slug = ${canonical}`

    const row = rows[0]
    if (!row || !row.is_active) {
      return null
    }

    const firmId = row.firm_id

    const idleRows = await this.prismaBootstrap.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${firmId}, true)`
      return tx.$queryRaw<Array<{ idleTimeoutMinutes: number }>>`
        SELECT "idleTimeoutMinutes" FROM firms WHERE id = ${firmId}
      `
    })

    const idle = idleRows[0]?.idleTimeoutMinutes ?? 0

    return { firmId, idleTimeoutMinutes: idle }
  }
}
