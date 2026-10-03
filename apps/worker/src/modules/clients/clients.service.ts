import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ClientType, FilerStatus, UserRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import type {
  AddClientNoteBody,
  CheckDuplicateQuery,
  CreateClientBody,
  ListClientsQuery,
  RevealClientFieldBody,
  UpdateClientBody,
} from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser, RequestMeta } from '../auth/auth.types'

import {
  buildCnicMasked,
  buildNtnMasked,
  clientIdLookupHmac,
  cnicDigits,
} from './client-crypto.util'
import { clientAuditBase } from './clients-audit.util'
import { isFirmWideClientAccess } from './clients.access'
import { FirmDataKeyService } from './firm-data-key.service'

type ClientRow = {
  id: string
  displayName: string
  type: ClientType
  filerStatus: FilerStatus
  isArchived: boolean
  cnicMasked: string | null
  ntnMasked: string | null
  aiConsentGiven?: boolean
  aiEnabled?: boolean
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
    private readonly firmDataKey: FirmDataKeyService,
  ) {}

  async list(user: AuthenticatedUser, query: ListClientsQuery) {
    this.assertStaff(user)
    const where = this.buildListWhere(user, query)
    const orderBy = this.buildOrderBy(query)

    return this.prismaRls.withRlsContext(async (tx) => {
      const [total, rows] = await Promise.all([
        tx.client.count({ where }),
        tx.client.findMany({
          where,
          orderBy,
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

  async getById(user: AuthenticatedUser, clientId: string) {
    this.assertStaff(user)
    const row = await this.findAccessibleClient(user, clientId, this.detailSelect())
    if (!row) {
      throw new NotFoundException(this.notFoundProblem())
    }
    return this.toDetail(row)
  }

  async create(user: AuthenticatedUser, body: CreateClientBody, meta: RequestMeta) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException(this.forbiddenProblem())
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      await this.assertNoDuplicate(tx, user.firmId, pickIdFields(body), undefined)

      const { dataKey } = await this.firmDataKey.getOrCreateDataKey(tx, user.firmId)
      try {
        const createData = await this.buildCreateData(tx, user.firmId, body, dataKey)
        const created = await tx.client.create({
          data: createData,
          select: this.detailSelect(),
        })

        if (!isFirmWideClientAccess(user.role)) {
          await tx.clientAccess.create({
            data: { clientId: created.id, userId: user.userId },
          })
        }

        await this.audit.log({
          ...clientAuditBase(user, meta),
          action: 'client.created',
          resourceType: 'client',
          resourceId: created.id,
          payload: { after: this.snapshotForAudit(created) },
        })

        return this.toDetail(created)
      } finally {
        dataKey.fill(0)
      }
    })
  }

  async update(
    user: AuthenticatedUser,
    clientId: string,
    body: UpdateClientBody,
    meta: RequestMeta,
  ) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException(this.forbiddenProblem())
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const existing = await this.findAccessibleClient(user, clientId, this.detailSelect(), tx)
      if (!existing) {
        throw new NotFoundException(this.notFoundProblem())
      }

      await this.assertNoDuplicate(tx, user.firmId, pickIdFields(body), clientId)

      const { dataKey } = await this.firmDataKey.getOrCreateDataKey(tx, user.firmId)
      try {
        const updateData = await this.buildUpdateData(user.firmId, body, dataKey)
        const updated = await tx.client.update({
          where: { id: clientId },
          data: updateData,
          select: this.detailSelect(),
        })

        await this.audit.log({
          ...clientAuditBase(user, meta),
          action: 'client.updated',
          resourceType: 'client',
          resourceId: clientId,
          payload: {
            before: this.snapshotForAudit(existing),
            after: this.snapshotForAudit(updated),
          },
        })

        return this.toDetail(updated)
      } finally {
        dataKey.fill(0)
      }
    })
  }

  async archive(user: AuthenticatedUser, clientId: string, meta: RequestMeta) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException(this.forbiddenProblem())
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const existing = await this.findAccessibleClient(user, clientId, this.detailSelect(), tx)
      if (!existing) {
        throw new NotFoundException(this.notFoundProblem())
      }
      if (existing.isArchived) {
        return this.toDetail(existing)
      }

      const updated = await tx.client.update({
        where: { id: clientId },
        data: { isArchived: true },
        select: this.detailSelect(),
      })

      await this.audit.log({
        ...clientAuditBase(user, meta),
        action: 'client.archived',
        resourceType: 'client',
        resourceId: clientId,
        payload: {
          before: { isArchived: false },
          after: { isArchived: true },
        },
      })

      return this.toDetail(updated)
    })
  }

  async remove(user: AuthenticatedUser, clientId: string, meta: RequestMeta) {
    this.assertStaff(user)

    return this.prismaRls.withRlsContext(async (tx) => {
      const existing = await this.findAccessibleClient(user, clientId, this.detailSelect(), tx)
      if (!existing) {
        throw new NotFoundException(this.notFoundProblem())
      }

      await tx.client.delete({ where: { id: clientId } })

      await this.audit.log({
        ...clientAuditBase(user, meta),
        action: 'client.deleted',
        resourceType: 'client',
        resourceId: clientId,
        payload: { before: this.snapshotForAudit(existing) },
      })
    })
  }

  async addNote(
    user: AuthenticatedUser,
    clientId: string,
    body: AddClientNoteBody,
    meta: RequestMeta,
  ) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException(this.forbiddenProblem())
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const client = await this.findAccessibleClient(user, clientId, { id: true }, tx)
      if (!client) {
        throw new NotFoundException(this.notFoundProblem())
      }

      const note = await tx.clientNote.create({
        data: {
          firmId: user.firmId,
          clientId,
          authorId: user.userId,
          body: body.body,
        },
        include: {
          author: { select: { name: true } },
        },
      })

      await this.audit.log({
        ...clientAuditBase(user, meta),
        action: 'client.note_added',
        resourceType: 'client',
        resourceId: clientId,
        payload: { noteId: note.id },
      })

      return {
        id: note.id,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        authorName: note.author.name,
      }
    })
  }

  async activity(user: AuthenticatedUser, clientId: string) {
    this.assertStaff(user)

    return this.prismaRls.withRlsContext(async (tx) => {
      const client = await this.findAccessibleClient(user, clientId, { id: true }, tx)
      if (!client) {
        throw new NotFoundException(this.notFoundProblem())
      }

      const [notes, audits] = await Promise.all([
        tx.clientNote.findMany({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { author: { select: { name: true } } },
        }),
        tx.auditLog.findMany({
          where: {
            resourceType: 'client',
            resourceId: clientId,
            action: {
              in: [
                'client.created',
                'client.updated',
                'client.archived',
                'client.deleted',
                'client.sensitive_field_view',
                'client.note_added',
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { user: { select: { name: true } } },
        }),
      ])

      const noteItems = notes.map((n) => ({
        id: n.id,
        kind: 'note' as const,
        at: n.createdAt.toISOString(),
        summary: n.body,
        authorName: n.author.name,
      }))

      const auditItems = audits.map((a) => ({
        id: a.id,
        kind: 'audit' as const,
        at: a.createdAt.toISOString(),
        summary: a.action,
        authorName: a.user?.name ?? null,
      }))

      const items = [...noteItems, ...auditItems].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      )

      return { items: items.slice(0, 50) }
    })
  }

  async revealField(
    user: AuthenticatedUser,
    clientId: string,
    body: RevealClientFieldBody,
    meta: RequestMeta,
  ) {
    this.assertStaff(user)

    return this.prismaRls.withRlsContext(async (tx) => {
      const client = await this.findAccessibleClient(
        user,
        clientId,
        {
          id: true,
          cnicEncrypted: true,
          ntnEncrypted: true,
        },
        tx,
      )
      if (!client) {
        throw new NotFoundException(this.notFoundProblem())
      }

      const dataKey = await this.firmDataKey.unwrapExistingKey(tx, user.firmId)
      if (!dataKey) {
        throw new UnprocessableEntityException({
          type: 'https://taxdesk.pk/problems/unprocessable',
          title: 'Encryption not configured',
          status: 422,
        })
      }

      try {
        const encrypted = body.field === 'cnic' ? client.cnicEncrypted : client.ntnEncrypted
        if (!encrypted) {
          throw new NotFoundException(this.notFoundProblem())
        }

        const value = await this.firmDataKey.decryptField(dataKey, encrypted)

        await this.audit.log({
          ...clientAuditBase(user, meta),
          action: 'client.sensitive_field_view',
          resourceType: 'client',
          resourceId: clientId,
          payload: { fieldName: body.field },
        })

        return { field: body.field, value }
      } finally {
        dataKey.fill(0)
      }
    })
  }

  async checkDuplicate(user: AuthenticatedUser, query: CheckDuplicateQuery) {
    this.assertStaff(user)

    return this.prismaRls.withRlsContext(async (tx) => {
      const result: {
        cnicMatch: { clientId: string; displayName: string } | null
        ntnMatch: { clientId: string; displayName: string } | null
      } = { cnicMatch: null, ntnMatch: null }

      if (query.cnic) {
        const hmac = clientIdLookupHmac(user.firmId, 'cnic', cnicDigits(query.cnic))
        const match = await tx.client.findFirst({
          where: {
            cnicLookupHmac: hmac,
            ...(query.excludeClientId ? { id: { not: query.excludeClientId } } : {}),
          },
          select: { id: true, displayName: true },
        })
        if (match) {
          result.cnicMatch = { clientId: match.id, displayName: match.displayName }
        }
      }

      if (query.ntn) {
        const normalised = query.ntn.replace(/\D/g, '')
        const hmac = clientIdLookupHmac(user.firmId, 'ntn', normalised)
        const match = await tx.client.findFirst({
          where: {
            ntnLookupHmac: hmac,
            ...(query.excludeClientId ? { id: { not: query.excludeClientId } } : {}),
          },
          select: { id: true, displayName: true },
        })
        if (match) {
          result.ntnMatch = { clientId: match.id, displayName: match.displayName }
        }
      }

      return result
    })
  }

  private assertStaff(user: AuthenticatedUser) {
    if (user.sessionType !== 'staff') {
      throw new ForbiddenException(this.forbiddenProblem())
    }
  }

  private buildListWhere(
    user: AuthenticatedUser,
    query: ListClientsQuery,
  ): Prisma.ClientWhereInput {
    const where: Prisma.ClientWhereInput = {
      firmId: user.firmId,
    }

    if (query.archived !== undefined) {
      where.isArchived = query.archived
    } else {
      where.isArchived = false
    }

    if (query.type) {
      where.type = query.type
    }
    if (query.filerStatus) {
      where.filerStatus = query.filerStatus
    }

    if (query.search) {
      const term = query.search.trim()
      where.OR = [
        { displayName: { contains: term, mode: 'insensitive' } },
        ...(term.length >= 4
          ? [
              { cnicLast4: { endsWith: term.slice(-4) } },
              { ntnLast4: { endsWith: term.slice(-4) } },
            ]
          : []),
      ]
    }

    if (!isFirmWideClientAccess(user.role)) {
      where.accessList = { some: { userId: user.userId } }
    }

    return where
  }

  private buildOrderBy(query: ListClientsQuery): Prisma.ClientOrderByWithRelationInput {
    return { [query.sortBy]: query.sortDir }
  }

  private summarySelect() {
    return {
      id: true,
      displayName: true,
      type: true,
      filerStatus: true,
      isArchived: true,
      cnicMasked: true,
      ntnMasked: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.ClientSelect
  }

  private detailSelect() {
    return {
      ...this.summarySelect(),
      aiConsentGiven: true,
      aiEnabled: true,
      notes: true,
    } satisfies Prisma.ClientSelect
  }

  private toSummary(row: ClientRow) {
    return {
      id: row.id,
      displayName: row.displayName,
      type: row.type,
      filerStatus: row.filerStatus,
      isArchived: row.isArchived,
      cnicMasked: row.cnicMasked,
      ntnMasked: row.ntnMasked,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private toDetail(row: ClientRow) {
    return {
      ...this.toSummary(row),
      aiConsentGiven: row.aiConsentGiven ?? false,
      aiEnabled: row.aiEnabled ?? true,
      notes: row.notes ?? null,
    }
  }

  private snapshotForAudit(row: ClientRow) {
    return {
      id: row.id,
      displayName: row.displayName,
      type: row.type,
      filerStatus: row.filerStatus,
      isArchived: row.isArchived,
      cnicMasked: row.cnicMasked,
      ntnMasked: row.ntnMasked,
    }
  }

  private async findAccessibleClient<T extends Prisma.ClientSelect>(
    user: AuthenticatedUser,
    clientId: string,
    select: T,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.ClientGetPayload<{ select: T }> | null> {
    const run = async (client: Prisma.TransactionClient) => {
      const where: Prisma.ClientWhereInput = {
        id: clientId,
        firmId: user.firmId,
      }
      if (!isFirmWideClientAccess(user.role)) {
        where.accessList = { some: { userId: user.userId } }
      }
      return client.client.findFirst({ where, select })
    }

    if (tx) {
      return run(tx)
    }
    return this.prismaRls.withRlsContext(run)
  }

  private async assertNoDuplicate(
    tx: Prisma.TransactionClient,
    firmId: string,
    body: { cnic?: string; ntn?: string },
    excludeClientId?: string,
  ) {
    const dup = await this.checkDuplicateInternal(tx, firmId, body, excludeClientId)
    if (dup.cnicMatch || dup.ntnMatch) {
      throw new UnprocessableEntityException({
        type: 'https://taxdesk.pk/problems/duplicate-client',
        title: 'Duplicate client',
        status: 422,
        duplicates: dup,
      })
    }
  }

  private async checkDuplicateInternal(
    tx: Prisma.TransactionClient,
    firmId: string,
    body: { cnic?: string; ntn?: string },
    excludeClientId?: string,
  ) {
    const result: {
      cnicMatch: { clientId: string; displayName: string } | null
      ntnMatch: { clientId: string; displayName: string } | null
    } = { cnicMatch: null, ntnMatch: null }

    if (body.cnic) {
      const hmac = clientIdLookupHmac(firmId, 'cnic', cnicDigits(body.cnic))
      const match = await tx.client.findFirst({
        where: {
          cnicLookupHmac: hmac,
          ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
        },
        select: { id: true, displayName: true },
      })
      if (match) {
        result.cnicMatch = { clientId: match.id, displayName: match.displayName }
      }
    }

    if (body.ntn) {
      const normalised = body.ntn.replace(/\D/g, '')
      const hmac = clientIdLookupHmac(firmId, 'ntn', normalised)
      const match = await tx.client.findFirst({
        where: {
          ntnLookupHmac: hmac,
          ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
        },
        select: { id: true, displayName: true },
      })
      if (match) {
        result.ntnMatch = { clientId: match.id, displayName: match.displayName }
      }
    }

    return result
  }

  private async buildCreateData(
    _tx: Prisma.TransactionClient,
    firmId: string,
    body: CreateClientBody,
    dataKey: Buffer,
  ): Promise<Prisma.ClientCreateInput> {
    const firm = { connect: { id: firmId } }
    const data: Prisma.ClientCreateInput = {
      firm,
      displayName: body.displayName,
      type: body.type,
      filerStatus: body.filerStatus ?? FilerStatus.UNKNOWN,
      aiConsentGiven: body.aiConsentGiven ?? false,
      aiEnabled: body.aiEnabled ?? true,
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    }

    if (body.cnic) {
      Object.assign(data, await this.cnicFields(body.cnic, firmId, dataKey))
    }
    if (body.ntn) {
      Object.assign(data, await this.ntnFields(body.ntn, firmId, dataKey))
    }

    return data
  }

  private async buildUpdateData(
    firmId: string,
    body: UpdateClientBody,
    dataKey: Buffer,
  ): Promise<Prisma.ClientUpdateInput> {
    const data: Prisma.ClientUpdateInput = {}

    if (body.displayName !== undefined) data.displayName = body.displayName
    if (body.type !== undefined) data.type = body.type
    if (body.filerStatus !== undefined) data.filerStatus = body.filerStatus
    if (body.aiConsentGiven !== undefined) data.aiConsentGiven = body.aiConsentGiven
    if (body.aiEnabled !== undefined) data.aiEnabled = body.aiEnabled
    if (body.notes !== undefined) data.notes = body.notes

    if (body.cnic !== undefined) {
      Object.assign(data, await this.cnicFields(body.cnic, firmId, dataKey))
    }
    if (body.ntn !== undefined) {
      Object.assign(data, await this.ntnFields(body.ntn, firmId, dataKey))
    }

    return data
  }

  private async cnicFields(cnic: string, firmId: string, dataKey: Buffer) {
    const digits = cnicDigits(cnic)
    return {
      cnicEncrypted: await this.firmDataKey.encryptField(dataKey, cnic),
      cnicLookupHmac: clientIdLookupHmac(firmId, 'cnic', digits),
      cnicLast4: digits.slice(-4),
      cnicMasked: buildCnicMasked(cnic),
    }
  }

  private async ntnFields(ntn: string, firmId: string, dataKey: Buffer) {
    const digits = ntn.replace(/\D/g, '')
    return {
      ntnEncrypted: await this.firmDataKey.encryptField(dataKey, ntn),
      ntnLookupHmac: clientIdLookupHmac(firmId, 'ntn', digits),
      ntnLast4: digits.slice(-4),
      ntnMasked: buildNtnMasked(ntn),
    }
  }

  private notFoundProblem() {
    return {
      type: 'https://taxdesk.pk/problems/not-found',
      title: 'Not found',
      status: 404,
    }
  }

  private forbiddenProblem() {
    return {
      type: 'https://taxdesk.pk/problems/forbidden',
      title: 'Forbidden',
      status: 403,
    }
  }
}

function pickIdFields(body: { cnic?: string | undefined; ntn?: string | undefined }): {
  cnic?: string
  ntn?: string
} {
  const out: { cnic?: string; ntn?: string } = {}
  if (body.cnic !== undefined) out.cnic = body.cnic
  if (body.ntn !== undefined) out.ntn = body.ntn
  return out
}
