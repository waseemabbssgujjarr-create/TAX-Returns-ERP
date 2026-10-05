import { randomUUID } from 'node:crypto'

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UserRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import type { ListDocumentsQuery, UpdateDocumentBody, UploadDocumentBody } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser, RequestMeta } from '../auth/auth.types'
import { isFirmWideClientAccess } from '../clients/clients.access'
import { DocumentProcessorService } from '../document-processor/document-processor.service'
import {
  OBJECT_STORAGE_PROVIDER,
  type ObjectStorageProvider,
} from '../storage/object-storage.interface'

import { documentAuditBase } from './documents-audit.util'
import { validateUploadFile } from './file-magic.util'

type DocumentRow = Prisma.DocumentGetPayload<{
  select: ReturnType<DocumentsService['summarySelect']>
}>

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
    private readonly documentProcessor: DocumentProcessorService,
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly storage: ObjectStorageProvider,
  ) {}

  async list(user: AuthenticatedUser, query: ListDocumentsQuery) {
    this.assertAuthenticatedSession(user)
    const clientId = this.resolveListClientId(user, query.clientId)
    await this.assertClientAccess(user, clientId)

    const where: Prisma.DocumentWhereInput = {
      firmId: user.firmId,
      clientId,
    }

    if (query.taxYear !== undefined) {
      where.taxYearFile = { taxYear: query.taxYear }
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const [total, rows] = await Promise.all([
        tx.document.count({ where }),
        tx.document.findMany({
          where,
          orderBy: { createdAt: 'desc' },
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

  async getById(user: AuthenticatedUser, documentId: string) {
    this.assertAuthenticatedSession(user)
    const row = await this.findAccessibleDocument(user, documentId, this.detailSelect())
    if (!row) {
      throw new NotFoundException(this.notFoundProblem())
    }
    return this.toDetail(row)
  }

  async listVersions(user: AuthenticatedUser, documentId: string) {
    this.assertAuthenticatedSession(user)
    const current = await this.findAccessibleDocument(user, documentId, {
      id: true,
      previousVersionId: true,
      version: true,
      clientId: true,
      taxYearFileId: true,
      originalName: true,
    })
    if (!current) {
      throw new NotFoundException(this.notFoundProblem())
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      // Walk the chain to the oldest, then collect forward from that root by tax year + name family.
      let rootId = current.id
      let cursor: string | null = current.previousVersionId
      const seen = new Set<string>([current.id])
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor)
        const prev = await tx.document.findFirst({
          where: { id: cursor, firmId: user.firmId, clientId: current.clientId },
          select: { id: true, previousVersionId: true },
        })
        if (!prev) break
        rootId = prev.id
        cursor = prev.previousVersionId
      }

      const chain: Array<{
        id: string
        originalName: string
        version: number
        status: string
        processingStatus: string
        createdAt: Date
        sizeBytes: number
        mimeType: string
        previousVersionId: string | null
      }> = []

      let nextId: string | null = rootId
      const visited = new Set<string>()
      while (nextId && !visited.has(nextId)) {
        visited.add(nextId)
        const row: {
          id: string
          originalName: string
          version: number
          status: string
          processingStatus: string
          createdAt: Date
          sizeBytes: number
          mimeType: string
          previousVersionId: string | null
        } | null = await tx.document.findFirst({
          where: { id: nextId, firmId: user.firmId },
          select: {
            id: true,
            originalName: true,
            version: true,
            status: true,
            processingStatus: true,
            createdAt: true,
            sizeBytes: true,
            mimeType: true,
            previousVersionId: true,
          },
        })
        if (!row) break
        chain.push(row)
        const newer: { id: string } | null = await tx.document.findFirst({
          where: {
            previousVersionId: row.id,
            firmId: user.firmId,
            clientId: current.clientId,
          },
          select: { id: true },
          orderBy: { version: 'desc' },
        })
        nextId = newer?.id ?? null
      }

      return {
        items: chain
          .sort((a, b) => b.version - a.version)
          .map((r) => ({
            id: r.id,
            originalName: r.originalName,
            version: r.version,
            status: r.status,
            processingStatus: r.processingStatus,
            createdAt: r.createdAt.toISOString(),
            sizeBytes: r.sizeBytes,
            mimeType: r.mimeType,
          })),
      }
    })
  }

  async getSignedDownloadUrl(user: AuthenticatedUser, documentId: string, meta: RequestMeta) {
    this.assertAuthenticatedSession(user)
    const row = await this.findAccessibleDocument(user, documentId, {
      id: true,
      storageKey: true,
      originalName: true,
    })
    if (!row) {
      throw new NotFoundException(this.notFoundProblem())
    }

    const storageConfig = this.config.get('storage') as { signedUrlExpiry: number }
    const expiresInSeconds = storageConfig.signedUrlExpiry
    const url = await this.storage.getSignedDownloadUrl(row.storageKey, expiresInSeconds)

    await this.audit.log({
      ...documentAuditBase(user, meta),
      action: 'document.access',
      resourceType: 'document',
      resourceId: row.id,
      payload: { originalName: row.originalName },
    })

    return { url, expiresInSeconds }
  }

  async upload(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    body: UploadDocumentBody,
    meta: RequestMeta,
  ) {
    this.assertAuthenticatedSession(user)
    if (user.sessionType === 'staff' && user.role === UserRole.REVIEWER) {
      throw new ForbiddenException(this.forbiddenProblem())
    }
    if (!file?.buffer) {
      throw new BadRequestException(this.validationProblem('File is required'))
    }

    const validation = validateUploadFile(file.buffer, file.mimetype, file.size)
    if (!validation.ok) {
      throw new UnprocessableEntityException(this.validationProblem(validation.reason))
    }

    const scopedBody = this.scopeUploadBody(user, body)
    const taxYearContext = await this.resolveTaxYearFile(user, scopedBody)

    const documentId = randomUUID()
    const storageKey = `firms/${user.firmId}/documents/${documentId}/${sanitizeFilename(file.originalname)}`
    const driver = this.storageDriver()

    const putResult = (await this.storage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: validation.mime,
      contentLength: file.size,
      firmId: user.firmId,
      ...(user.sessionType === 'staff' ? { storageOwnerUserId: user.userId } : {}),
      clientId: taxYearContext.clientId,
      taxYear: taxYearContext.taxYear,
    })) ?? {}

    try {
      const created = await this.prismaRls.withRlsContext(async (tx) => {
        const doc = await tx.document.create({
          data: {
            id: documentId,
            firmId: user.firmId,
            clientId: taxYearContext.clientId,
            taxYearFileId: taxYearContext.taxYearFileId,
            originalName: file.originalname,
            storageKey,
            mimeType: validation.mime,
            sizeBytes: file.size,
            uploadedById: user.sessionType === 'staff' ? user.userId : null,
            status: 'UPLOADED',
            processingStatus: 'PENDING',
            storageProvider: driver === 'google-drive' ? 'GOOGLE_DRIVE' : 'LOCAL',
            storageOwnerUserId: putResult.resolvedOwnerUserId ?? null,
            driveFileId: putResult.providerFileId ?? null,
            driveFolderId: putResult.providerFolderId ?? null,
          },
          select: this.detailSelect(),
        })

        await this.audit.log({
          ...documentAuditBase(user, meta),
          action: 'document.upload',
          resourceType: 'document',
          resourceId: doc.id,
          payload: {
            after: {
              clientId: doc.clientId,
              taxYearFileId: doc.taxYearFileId,
              originalName: doc.originalName,
              mimeType: doc.mimeType,
              sizeBytes: doc.sizeBytes,
              portal: user.sessionType === 'portal',
            },
          },
        })

        return doc
      })

      await this.documentProcessor.enqueue({
        documentId: created.id,
        firmId: user.firmId,
        storageKey,
        mimeType: validation.mime,
        taxYearFileId: taxYearContext.taxYearFileId,
      })

      return this.toDetail(created)
    } catch (err) {
      await this.storage.deleteObject(storageKey).catch(() => undefined)
      throw err
    }
  }

  async uploadVersion(
    user: AuthenticatedUser,
    previousDocumentId: string,
    file: Express.Multer.File | undefined,
    meta: RequestMeta,
  ) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException(this.forbiddenProblem())
    }
    if (!file?.buffer) {
      throw new BadRequestException(this.validationProblem('File is required'))
    }

    const validation = validateUploadFile(file.buffer, file.mimetype, file.size)
    if (!validation.ok) {
      throw new UnprocessableEntityException(this.validationProblem(validation.reason))
    }

    const previous = await this.findAccessibleDocument(user, previousDocumentId, {
      id: true,
      clientId: true,
      taxYearFileId: true,
      version: true,
      category: true,
      originalName: true,
      taxYearFile: { select: { taxYear: true } },
    })
    if (!previous) {
      throw new NotFoundException(this.notFoundProblem())
    }

    const documentId = randomUUID()
    const storageKey = `firms/${user.firmId}/documents/${documentId}/${sanitizeFilename(file.originalname)}`
    const driver = this.storageDriver()

    const putResult = (await this.storage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: validation.mime,
      contentLength: file.size,
      firmId: user.firmId,
      storageOwnerUserId: user.userId,
      clientId: previous.clientId,
      taxYear: previous.taxYearFile?.taxYear,
    })) ?? {}

    try {
      const created = await this.prismaRls.withRlsContext(async (tx) => {
        const doc = await tx.document.create({
          data: {
            id: documentId,
            firmId: user.firmId,
            clientId: previous.clientId,
            taxYearFileId: previous.taxYearFileId,
            originalName: file.originalname,
            storageKey,
            mimeType: validation.mime,
            sizeBytes: file.size,
            uploadedById: user.userId,
            category: previous.category,
            previousVersionId: previous.id,
            version: previous.version + 1,
            status: 'UPLOADED',
            processingStatus: 'PENDING',
            storageProvider: driver === 'google-drive' ? 'GOOGLE_DRIVE' : 'LOCAL',
            storageOwnerUserId: putResult.resolvedOwnerUserId ?? null,
            driveFileId: putResult.providerFileId ?? null,
            driveFolderId: putResult.providerFolderId ?? null,
          },
          select: this.detailSelect(),
        })

        await this.audit.log({
          ...documentAuditBase(user, meta),
          action: 'document.version_upload',
          resourceType: 'document',
          resourceId: doc.id,
          payload: {
            after: {
              previousVersionId: previous.id,
              version: doc.version,
              originalName: doc.originalName,
            },
          },
        })

        return doc
      })

      await this.documentProcessor.enqueue({
        documentId: created.id,
        firmId: user.firmId,
        storageKey,
        mimeType: validation.mime,
        taxYearFileId: previous.taxYearFileId,
      })

      return this.toDetail(created)
    } catch (err) {
      await this.storage.deleteObject(storageKey).catch(() => undefined)
      throw err
    }
  }

  async update(
    user: AuthenticatedUser,
    documentId: string,
    body: UpdateDocumentBody,
    meta: RequestMeta,
  ) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException(this.forbiddenProblem())
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const existing = await this.findAccessibleDocument(user, documentId, this.detailSelect(), tx)
      if (!existing) {
        throw new NotFoundException(this.notFoundProblem())
      }

      const updated = await tx.document.update({
        where: { id: documentId },
        data: {
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.processingStatus !== undefined
            ? { processingStatus: body.processingStatus }
            : {}),
          ...(body.extractionStatus !== undefined
            ? { extractionStatus: body.extractionStatus }
            : {}),
          ...(body.reviewStatus !== undefined ? { reviewStatus: body.reviewStatus } : {}),
        },
        select: this.detailSelect(),
      })

      await this.audit.log({
        ...documentAuditBase(user, meta),
        action: 'document.updated',
        resourceType: 'document',
        resourceId: documentId,
        payload: {
          before: this.snapshotForAudit(existing),
          after: this.snapshotForAudit(updated),
        },
      })

      return this.toDetail(updated)
    })
  }

  async remove(user: AuthenticatedUser, documentId: string, meta: RequestMeta) {
    this.assertStaff(user)
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException(this.forbiddenProblem())
    }

    const existing = await this.findAccessibleDocument(user, documentId, {
      id: true,
      storageKey: true,
      originalName: true,
      clientId: true,
      taxYearFileId: true,
    })
    if (!existing) {
      throw new NotFoundException(this.notFoundProblem())
    }

    await this.storage.deleteObject(existing.storageKey)

    await this.prismaRls.withRlsContext(async (tx) => {
      await tx.document.delete({ where: { id: documentId } })

      await this.audit.log({
        ...documentAuditBase(user, meta),
        action: 'document.delete',
        resourceType: 'document',
        resourceId: documentId,
        payload: {
          before: {
            originalName: existing.originalName,
            clientId: existing.clientId,
            taxYearFileId: existing.taxYearFileId,
          },
        },
      })
    })
  }

  /** Current STORAGE_DRIVER — mirrors StorageModule's resolution. */
  private storageDriver(): string {
    const storage = this.config.get('storage') as { driver?: string }
    return (process.env['STORAGE_DRIVER'] ?? storage.driver ?? 's3').toString().toLowerCase()
  }

  private async resolveTaxYearFile(user: AuthenticatedUser, body: UploadDocumentBody) {
    return this.prismaRls.withRlsContext(async (tx) => {
      if (body.taxYearFileId) {
        const file = await tx.taxYearFile.findFirst({
          where: {
            id: body.taxYearFileId,
            client: { firmId: user.firmId },
          },
          select: { id: true, clientId: true, taxYear: true },
        })
        if (!file) {
          throw new NotFoundException(this.notFoundProblem())
        }
        await this.assertClientAccess(user, file.clientId, tx)
        return { taxYearFileId: file.id, clientId: file.clientId, taxYear: file.taxYear }
      }

      const clientId = body.clientId!
      const taxYear = body.taxYear!
      await this.assertClientAccess(user, clientId, tx)

      const existing = await tx.taxYearFile.findUnique({
        where: { clientId_taxYear: { clientId, taxYear } },
        select: { id: true, clientId: true, taxYear: true },
      })
      if (existing) {
        return { taxYearFileId: existing.id, clientId: existing.clientId, taxYear: existing.taxYear }
      }

      const created = await tx.taxYearFile.create({
        data: { clientId, taxYear },
        select: { id: true, clientId: true, taxYear: true },
      })
      return { taxYearFileId: created.id, clientId: created.clientId, taxYear: created.taxYear }
    })
  }

  private async assertClientAccess(
    user: AuthenticatedUser,
    clientId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (user.sessionType === 'portal') {
      if (!user.clientId || user.clientId !== clientId) {
        throw new NotFoundException(this.notFoundProblem())
      }
      return
    }

    const run = async (client: Prisma.TransactionClient) => {
      const where: Prisma.ClientWhereInput = {
        id: clientId,
        firmId: user.firmId,
      }
      if (!isFirmWideClientAccess(user.role)) {
        where.accessList = { some: { userId: user.userId } }
      }
      const found = await client.client.findFirst({ where, select: { id: true } })
      if (!found) {
        throw new NotFoundException(this.notFoundProblem())
      }
    }

    if (tx) {
      await run(tx)
      return
    }
    await this.prismaRls.withRlsContext(run)
  }

  private async findAccessibleDocument<T extends Prisma.DocumentSelect>(
    user: AuthenticatedUser,
    documentId: string,
    select: T,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.DocumentGetPayload<{ select: T }> | null> {
    const run = async (client: Prisma.TransactionClient) => {
      const whereDoc: Prisma.DocumentWhereInput = {
        id: documentId,
        firmId: user.firmId,
      }
      if (user.sessionType === 'portal') {
        if (!user.clientId) return null
        whereDoc.clientId = user.clientId
      }

      const meta = await client.document.findFirst({
        where: whereDoc,
        select: { id: true, clientId: true },
      })
      if (!meta) {
        return null
      }

      if (user.sessionType === 'staff') {
        const where: Prisma.ClientWhereInput = {
          id: meta.clientId,
          firmId: user.firmId,
        }
        if (!isFirmWideClientAccess(user.role)) {
          where.accessList = { some: { userId: user.userId } }
        }
        const access = await client.client.findFirst({ where, select: { id: true } })
        if (!access) {
          return null
        }
      }

      return client.document.findFirst({
        where: { id: documentId },
        select,
      })
    }

    if (tx) {
      return run(tx)
    }
    return this.prismaRls.withRlsContext(run)
  }

  private summarySelect() {
    return {
      id: true,
      clientId: true,
      taxYearFileId: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      category: true,
      status: true,
      processingStatus: true,
      extractionStatus: true,
      reviewStatus: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.DocumentSelect
  }

  private detailSelect() {
    return {
      ...this.summarySelect(),
      documentType: true,
      confidence: true,
      uploadedById: true,
      previousVersionId: true,
      extractedFields: true,
      verifiedAt: true,
      verifiedById: true,
      taxYearFile: { select: { taxYear: true } },
    } satisfies Prisma.DocumentSelect
  }

  private toSummary(row: DocumentRow) {
    return {
      id: row.id,
      clientId: row.clientId,
      taxYearFileId: row.taxYearFileId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      category: row.category,
      status: row.status,
      processingStatus: row.processingStatus,
      extractionStatus: row.extractionStatus,
      reviewStatus: row.reviewStatus,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private toDetail(
    row: Prisma.DocumentGetPayload<{ select: ReturnType<DocumentsService['detailSelect']> }>,
  ) {
    return {
      ...this.toSummary(row),
      documentType: row.documentType,
      confidence: row.confidence,
      uploadedById: row.uploadedById,
      previousVersionId: row.previousVersionId,
      extractedFields: row.extractedFields ?? null,
      taxYear: row.taxYearFile?.taxYear ?? null,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      verifiedById: row.verifiedById,
    }
  }

  private snapshotForAudit(row: DocumentRow) {
    return {
      category: row.category,
      status: row.status,
      processingStatus: row.processingStatus,
      extractionStatus: row.extractionStatus,
      reviewStatus: row.reviewStatus,
    }
  }

  private resolveListClientId(user: AuthenticatedUser, requested?: string): string {
    if (user.sessionType === 'portal') {
      if (!user.clientId) {
        throw new ForbiddenException(this.forbiddenProblem())
      }
      if (requested && requested !== user.clientId) {
        throw new NotFoundException(this.notFoundProblem())
      }
      return user.clientId
    }
    if (!requested) {
      throw new BadRequestException(this.validationProblem('clientId is required'))
    }
    return requested
  }

  private scopeUploadBody(user: AuthenticatedUser, body: UploadDocumentBody): UploadDocumentBody {
    if (user.sessionType !== 'portal') {
      return body
    }
    if (!user.clientId) {
      throw new ForbiddenException(this.forbiddenProblem())
    }
    if (body.clientId && body.clientId !== user.clientId) {
      throw new NotFoundException(this.notFoundProblem())
    }
    return {
      ...body,
      clientId: user.clientId,
    }
  }

  private assertAuthenticatedSession(user: AuthenticatedUser) {
    if (user.sessionState !== 'full') {
      throw new ForbiddenException(this.forbiddenProblem())
    }
    if (user.sessionType !== 'staff' && user.sessionType !== 'portal') {
      throw new ForbiddenException(this.forbiddenProblem())
    }
  }

  private assertStaff(user: AuthenticatedUser) {
    if (user.sessionType !== 'staff' || user.sessionState !== 'full') {
      throw new ForbiddenException(this.forbiddenProblem())
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

  private validationProblem(detail: string) {
    return {
      type: 'https://taxdesk.pk/problems/validation-error',
      title: 'Validation error',
      status: 422,
      detail,
    }
  }
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, '_').replace(/\.\./g, '_')
  return base.slice(0, 200) || 'upload'
}
