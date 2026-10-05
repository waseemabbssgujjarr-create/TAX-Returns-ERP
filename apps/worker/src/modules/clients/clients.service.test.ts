import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'

import { ClientsService } from './clients.service'
import type { FirmDataKeyService } from './firm-data-key.service'

describe('ClientsService', () => {
  let service: ClientsService
  let prismaRls: PrismaRlsClient
  let audit: AuditService
  let firmDataKey: FirmDataKeyService
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let unwrapExistingKeyMock: ReturnType<typeof vi.fn>
  let decryptFieldMock: ReturnType<typeof vi.fn>
  let auditLogMock: ReturnType<typeof vi.fn>

  const owner: AuthenticatedUser = {
    userId: 'user-1',
    firmId: 'firm-1',
    role: UserRole.OWNER,
    sessionState: 'full',
    sessionType: 'staff',
    jti: 'jti',
  }

  const associate: AuthenticatedUser = {
    ...owner,
    userId: 'user-2',
    role: UserRole.ASSOCIATE,
  }

  beforeEach(() => {
    process.env['CLIENT_LOOKUP_HMAC_SECRET'] = 'test-hmac-secret'

    withRlsContextMock = vi.fn()
    unwrapExistingKeyMock = vi.fn()
    decryptFieldMock = vi.fn()
    auditLogMock = vi.fn()

    prismaRls = {
      withRlsContext: withRlsContextMock,
    } as unknown as PrismaRlsClient

    audit = {
      log: auditLogMock,
    } as unknown as AuditService

    firmDataKey = {
      getOrCreateDataKey: vi.fn(),
      unwrapExistingKey: unwrapExistingKeyMock,
      encryptField: vi.fn(),
      decryptField: decryptFieldMock,
    } as unknown as FirmDataKeyService

    service = new ClientsService(prismaRls, audit, firmDataKey)
  })

  it('rejects portal sessions', async () => {
    await expect(
      service.list(
        { ...owner, sessionType: 'portal', clientId: 'c-1' },
        { page: 1, pageSize: 20, sortBy: 'displayName', sortDir: 'asc' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('returns 404 for inaccessible client (associate without access)', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        client: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }
      return fn(tx as never)
    })

    await expect(service.getById(associate, 'missing-id')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('scopes associate list to ClientAccess', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const findMany = vi.fn().mockResolvedValue([])
      const count = vi.fn().mockResolvedValue(0)
      const tx = { client: { findMany, count } }
      const result = fn(tx as never)
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            firmId: associate.firmId,
            isArchived: false,
            accessList: { some: { userId: associate.userId } },
          },
        }),
      )
      return result
    })

    await service.list(associate, {
      page: 1,
      pageSize: 20,
      sortBy: 'displayName',
      sortDir: 'asc',
    })
  })

  it('logs sensitive_field_view on reveal', async () => {
    const encrypted = Buffer.from('cipher')
    unwrapExistingKeyMock.mockResolvedValue(Buffer.alloc(32, 1))
    decryptFieldMock.mockResolvedValue('35202-1234567-1')

    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        client: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'client-1',
            cnicEncrypted: encrypted,
            ntnEncrypted: null,
          }),
        },
      }
      return fn(tx as never)
    })

    const result = await service.revealField(
      owner,
      'client-1',
      { field: 'cnic' },
      { ipAddress: '127.0.0.1' },
    )

    expect(result.value).toBe('35202-1234567-1')
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client.sensitive_field_view',
        payload: { fieldName: 'cnic' },
      }),
    )
  })
})
