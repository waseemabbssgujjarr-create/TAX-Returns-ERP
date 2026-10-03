import { DocumentCategory, DocumentStatus, DocumentExtractionStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { ObjectStorageProvider } from '../storage/object-storage.interface'

import { AiExtractionHandlerService } from './ai-extraction-handler.service'
import type { AiExtractionProvider } from './ai-extraction.provider'

const salaryPayload = {
  employerName: 'Acme',
  employerNtn: null,
  employerAddress: null,
  employeeName: 'Ali',
  employeeCnicLast4: '1234',
  employeeDesignation: null,
  periodStart: null,
  periodEnd: null,
  documentSubtype: 'UNKNOWN' as const,
  basicSalary: 10000000,
  allowances: [],
  totalAllowances: null,
  perquisites: null,
  bonus: null,
  grossSalary: 10000000,
  providentFundEmployee: null,
  providentFundEmployer: null,
  otherDeductions: null,
  taxDeducted: null,
  annualTaxDeducted: null,
  netPay: null,
  fieldConfidence: { grossSalary: 0.9 },
  overallConfidence: 0.9,
  pagesCovered: [1],
}

describe('AiExtractionHandlerService', () => {
  let prismaRls: PrismaRlsClient
  let provider: AiExtractionProvider
  let storage: ObjectStorageProvider
  let service: AiExtractionHandlerService
  let documentUpdate: ReturnType<typeof vi.fn>
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let extractMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    documentUpdate = vi.fn().mockResolvedValue({})

    withRlsContextMock = vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        document: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'doc-1',
            firmId: 'firm-1',
            mimeType: 'application/pdf',
            documentType: 'SALARY_CERTIFICATE',
            category: DocumentCategory.SALARY_CERTIFICATE,
            extractionStatus: DocumentExtractionStatus.NOT_STARTED,
            status: DocumentStatus.UPLOADED,
          }),
          update: documentUpdate,
        },
        aiCallLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx as never)
    })

    prismaRls = {
      withRlsContext: withRlsContextMock,
    } as unknown as PrismaRlsClient

    extractMock = vi.fn().mockResolvedValue({
      fields: salaryPayload,
      fieldConfidence: salaryPayload.fieldConfidence,
      overallConfidence: 0.9,
      pageReferences: {},
      sourceSnippets: {},
      model: 'gpt-4o',
      usage: { inputTokens: 10, outputTokens: 20, costPaisaEst: 0 },
    })

    provider = {
      classify: vi.fn(),
      extract: extractMock,
      mapColumns: vi.fn(),
    }

    storage = {
      putObject: vi.fn(),
      deleteObject: vi.fn(),
      getSignedDownloadUrl: vi.fn(),
      getObject: vi.fn(),
    }

    service = new AiExtractionHandlerService(prismaRls, provider, storage)
  })

  it('persists provisional extracted fields and sets EXTRACTED + IN_REVIEW', async () => {
    await service.processJob({
      documentId: 'doc-1',
      firmId: 'firm-1',
      storageKey: 'key',
      documentType: 'SALARY_CERTIFICATE',
      taxYearFileId: 'tyf-1',
    })

    type UpdateArg = {
      data: {
        status: DocumentStatus
        extractedFields: { provisional: boolean; awaitingReview: boolean }
      }
    }
    const lastUpdate = documentUpdate.mock.calls.at(-1)?.[0] as UpdateArg
    expect(lastUpdate.data.status).toBe(DocumentStatus.EXTRACTED)
    expect(lastUpdate.data.extractedFields.provisional).toBe(true)
    expect(lastUpdate.data.extractedFields.awaitingReview).toBe(true)
  })

  it('skips when already extracted (idempotent)', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        document: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'doc-1',
            firmId: 'firm-1',
            extractionStatus: DocumentExtractionStatus.COMPLETE,
            status: DocumentStatus.EXTRACTED,
          }),
          update: documentUpdate,
        },
      }
      return fn(tx as never)
    })

    await service.processJob({
      documentId: 'doc-1',
      firmId: 'firm-1',
      storageKey: 'key',
      documentType: 'SALARY_CERTIFICATE',
      taxYearFileId: 'tyf-1',
    })

    expect(extractMock).not.toHaveBeenCalled()
  })
})
