import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import type { CreateTaxYearBody, ListTaxYearsQuery, UpdateTaxYearBody } from '@taxdesk/schemas'
import { TaxYearSectionsSchema as TaxYearSectionsZod } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuthenticatedUser } from '../auth/auth.types'
import { isFirmWideClientAccess } from '../clients/clients.access'

type TaxYearRow = Prisma.TaxYearFileGetPayload<{
  select: ReturnType<TaxYearsService['summarySelect']>
}>

@Injectable()
export class TaxYearsService {
  constructor(private readonly prismaRls: PrismaRlsClient) {}

  /**
   * Firm-wide "Returns" list — one screen showing the whole book, overdue first (F4).
   * Respects per-user client access the same way the client-scoped list does.
   */
  async listForFirm(user: AuthenticatedUser, query: ListTaxYearsQuery) {
    this.assertStaff(user)
    const firmWide = isFirmWideClientAccess(user.role)

    return this.prismaRls.withRlsContext(async (tx) => {
      const where: Prisma.TaxYearFileWhereInput = {
        client: {
          firmId: user.firmId,
          isArchived: false,
          ...(firmWide ? {} : { accessList: { some: { userId: user.userId } } }),
        },
      }

      const [total, rows] = await Promise.all([
        tx.taxYearFile.count({ where }),
        tx.taxYearFile.findMany({
          where,
          orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { taxYear: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: { ...this.summarySelect(), client: { select: { displayName: true } } },
        }),
      ])

      const filings = rows.length
        ? await tx.irisFiling.findMany({
            where: { taxYearFileId: { in: rows.map((r) => r.id) } },
            select: { taxYearFileId: true, status: true },
          })
        : []
      const filingStatusByTaxYearFileId = new Map(filings.map((f) => [f.taxYearFileId, f.status]))

      const now = Date.now()
      return {
        items: rows.map((r) => ({
          ...this.toSummary(r),
          clientName: r.client.displayName,
          filingStatus: filingStatusByTaxYearFileId.get(r.id) ?? null,
          overdue:
            r.dueDate !== null &&
            r.dueDate.getTime() < now &&
            r.status !== 'FILED' &&
            r.status !== 'CLOSED',
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      }
    })
  }

  async listByClient(user: AuthenticatedUser, clientId: string, query: ListTaxYearsQuery) {
    this.assertStaff(user)
    await this.assertClientAccess(user, clientId)

    return this.prismaRls.withRlsContext(async (tx) => {
      const where: Prisma.TaxYearFileWhereInput = { clientId }

      const [total, rows] = await Promise.all([
        tx.taxYearFile.count({ where }),
        tx.taxYearFile.findMany({
          where,
          orderBy: { taxYear: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: this.summarySelect(),
        }),
      ])

      return {
        items: rows.map((r) => this.toSummary(r)),
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      }
    })
  }

  async getById(user: AuthenticatedUser, taxYearFileId: string) {
    this.assertStaff(user)
    const row = await this.findAccessible(user, taxYearFileId, this.detailSelect())
    if (!row) {
      throw new NotFoundException({ title: 'Tax year not found' })
    }
    return this.toDetail(row)
  }

  async createForClient(user: AuthenticatedUser, clientId: string, body: CreateTaxYearBody) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException({ title: 'Reviewers cannot create tax years' })
    }
    await this.assertClientAccess(user, clientId)

    return this.prismaRls.withRlsContext(async (tx) => {
      const existing = await tx.taxYearFile.findUnique({
        where: { clientId_taxYear: { clientId, taxYear: body.taxYear } },
      })
      if (existing) {
        throw new UnprocessableEntityException({
          title: 'Tax year already exists for this client',
        })
      }

      const createData: Prisma.TaxYearFileCreateInput = {
        client: { connect: { id: clientId } },
        taxYear: body.taxYear,
        sections: this.defaultSections(),
      }
      if (body.dueDate) createData.dueDate = new Date(body.dueDate)
      if (body.assigneeId) createData.assigneeId = body.assigneeId

      const created = await tx.taxYearFile.create({
        data: createData,
        select: this.detailSelect(),
      })

      return this.toDetail(created)
    })
  }

  async update(user: AuthenticatedUser, taxYearFileId: string, body: UpdateTaxYearBody) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException({ title: 'Reviewers cannot edit tax years' })
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const existing = await this.findAccessible(user, taxYearFileId, this.detailSelect(), tx)
      if (!existing) {
        throw new NotFoundException({ title: 'Tax year not found' })
      }

      let sections: Prisma.InputJsonValue | undefined
      if (body.sections !== undefined) {
        const parsed = TaxYearSectionsZod.safeParse(body.sections)
        if (!parsed.success) {
          throw new UnprocessableEntityException({ title: 'Invalid section payload' })
        }
        sections = parsed.data as Prisma.InputJsonValue
      }

      const updated = await tx.taxYearFile.update({
        where: { id: taxYearFileId },
        data: {
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.dueDate !== undefined
            ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
            : {}),
          ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
          ...(sections !== undefined ? { sections } : {}),
        },
        select: this.detailSelect(),
      })

      return this.toDetail(updated)
    })
  }

  private defaultSections(): Prisma.InputJsonValue {
    return TaxYearSectionsZod.parse({}) as Prisma.InputJsonValue
  }

  private summarySelect() {
    return {
      id: true,
      clientId: true,
      taxYear: true,
      status: true,
      assigneeId: true,
      dueDate: true,
      rulesVersion: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  private detailSelect() {
    return {
      ...this.summarySelect(),
      sections: true,
    } as const
  }

  private toSummary(row: TaxYearRow) {
    return {
      id: row.id,
      clientId: row.clientId,
      taxYear: row.taxYear,
      status: row.status,
      assigneeId: row.assigneeId,
      dueDate: row.dueDate?.toISOString() ?? null,
      rulesVersion: row.rulesVersion,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private toDetail(row: TaxYearRow & { sections: Prisma.JsonValue }) {
    const sections = TaxYearSectionsZod.parse(row.sections ?? {})
    return {
      ...this.toSummary(row),
      sections,
    }
  }

  private async findAccessible(
    user: AuthenticatedUser,
    taxYearFileId: string,
    select: ReturnType<TaxYearsService['detailSelect']>,
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (client: Prisma.TransactionClient) => {
      const file = await client.taxYearFile.findFirst({
        where: {
          id: taxYearFileId,
          client: { firmId: user.firmId, isArchived: false },
        },
        select,
      })
      if (!file) return null
      await this.assertClientAccess(user, file.clientId)
      return file
    }

    if (tx) return run(tx)
    return this.prismaRls.withRlsContext(run)
  }

  private assertStaff(user: AuthenticatedUser) {
    if (user.sessionType !== 'staff' || user.sessionState !== 'full') {
      throw new ForbiddenException({ title: 'Staff session required' })
    }
  }

  private async assertClientAccess(user: AuthenticatedUser, clientId: string) {
    if (isFirmWideClientAccess(user.role)) return

    await this.prismaRls.withRlsContext(async (tx) => {
      const access = await tx.clientAccess.findUnique({
        where: { clientId_userId: { clientId, userId: user.userId } },
      })
      if (!access) {
        throw new ForbiddenException({ title: 'No access to this client' })
      }
    })
  }
}
