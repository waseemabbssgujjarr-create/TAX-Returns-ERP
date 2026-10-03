import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { UserRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'
import type { DocumentProcessorService } from '../document-processor/document-processor.service'
import type { ObjectStorageProvider } from '../storage/object-storage.interface'

import { DocumentsService } from './documents.service'

describe('DocumentsService', () => {
  let service: DocumentsService
  let prismaRls: PrismaRlsClient
  let audit: AuditService
  let storage: ObjectStorageProvider
  let documentProcessor: DocumentProcessorService
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let putObjectMock: ReturnType<typeof vi.fn>
  let auditLogMock: ReturnType<typeof vi.fn>
  let enqueueMock: ReturnType<typeof vi.fn>

  const owner: AuthenticatedUser = {
    userId: 'user-1',
    firmId: 'firm-1',
    role: UserRole.OWNER,
    sessionState: 'full',
    sessionType: 'staff',
    jti: 'jti',
  }

  beforeEach(() => {
    withRlsContextMock = vi.fn()
    putObjectMock = vi.fn()
    auditLogMock = vi.fn()
    enqueueMock = vi.fn()

    prismaRls = {
      withRlsContext: withRlsContextMock,
    } as unknown as PrismaRlsClient

    audit = { log: auditLogMock } as unknown as AuditService

    storage = {
      putObject: putObjectMock,
      deleteObject: vi.fn(),
      getObject: vi.fn(),
      getSignedDownloadUrl: vi.fn().mockResolvedValue('https://signed.example/doc'),
    }

    documentProcessor = {
      enqueue: enqueueMock,
    } as unknown as DocumentProcessorService

    const config = {
      get: vi.fn().mockReturnValue({ signedUrlExpiry: 900 }),
    } as unknown as ConfigService

    service = new DocumentsService(prismaRls, audit, documentProcessor, config, storage)
  })

  it('allows portal sessions to list their own client documents', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        document: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
        },
      }
      return fn(tx as never)
    })

    const result = await service.list(
      { ...owner, sessionType: 'portal', clientId: 'c-1' },
      { page: 1, pageSize: 20 },
    )
    expect(result.items).toEqual([])
  })

  it('rejects portal list for a different clientId', async () => {
    await expect(
      service.list(
        { ...owner, sessionType: 'portal', clientId: 'c-1' },
        { page: 1, pageSize: 20, clientId: 'c-other' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('rejects invalid magic bytes on upload', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        taxYearFile: {
          findFirst: vi.fn().mockResolvedValue({ id: 'tyf-1', clientId: 'c-1' }),
        },
        client: {
          findFirst: vi.fn().mockResolvedValue({ id: 'c-1' }),
        },
      }
      return fn(tx as never)
    })

    const file = {
      buffer: Buffer.from('plain text'),
      mimetype: 'application/pdf',
      size: 12,
      originalname: 'fake.pdf',
    } as Express.Multer.File

    await expect(
      service.upload(owner, file, { taxYearFileId: 'tyf-1' }, { ipAddress: '127.0.0.1' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)

    expect(putObjectMock).not.toHaveBeenCalled()
  })

  it('uploads, creates row, audits, and enqueues processing', async () => {
    const pdf = Buffer.from('%PDF-1.4 test')

    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        taxYearFile: {
          findFirst: vi.fn().mockResolvedValue({ id: 'tyf-1', clientId: 'c-1' }),
        },
        client: {
          findFirst: vi.fn().mockResolvedValue({ id: 'c-1' }),
        },
        document: {
          create: vi.fn().mockResolvedValue({
            id: 'doc-1',
            clientId: 'c-1',
            taxYearFileId: 'tyf-1',
            originalName: 'cert.pdf',
            mimeType: 'application/pdf',
            sizeBytes: pdf.length,
            category: 'UNCATEGORIZED',
            status: 'UPLOADED',
            processingStatus: 'PENDING',
            extractionStatus: 'NOT_STARTED',
            reviewStatus: 'NOT_STARTED',
            version: 1,
            documentType: null,
            confidence: null,
            uploadedById: owner.userId,
            previousVersionId: null,
            extractedFields: null,
            verifiedAt: null,
            verifiedById: null,
            taxYearFile: { taxYear: 2025 },
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            updatedAt: new Date('2025-01-01T00:00:00.000Z'),
          }),
        },
      }
      return fn(tx as never)
    })

    const file = {
      buffer: pdf,
      mimetype: 'application/pdf',
      size: pdf.length,
      originalname: 'cert.pdf',
    } as Express.Multer.File

    const result = await service.upload(
      owner,
      file,
      { taxYearFileId: 'tyf-1' },
      { ipAddress: '127.0.0.1' },
    )

    expect(putObjectMock).toHaveBeenCalled()
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.upload', resourceId: 'doc-1' }),
    )
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc-1', firmId: 'firm-1' }),
    )
    expect(result.id).toBe('doc-1')
  })

  it('returns 404 for inaccessible document download', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        document: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }
      return fn(tx as never)
    })

    await expect(service.getSignedDownloadUrl(owner, 'missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('logs document.access when issuing signed URL', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        document: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'doc-1',
            storageKey: 'firms/firm-1/documents/doc-1/file.pdf',
            originalName: 'file.pdf',
            clientId: 'c-1',
          }),
        },
        client: {
          findFirst: vi.fn().mockResolvedValue({ id: 'c-1' }),
        },
      }
      return fn(tx as never)
    })

    const result = await service.getSignedDownloadUrl(owner, 'doc-1', {})
    expect(result.url).toContain('https://')
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.access', resourceId: 'doc-1' }),
    )
  })
})
