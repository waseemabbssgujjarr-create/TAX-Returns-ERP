import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { UserRole } from '@prisma/client'
import type * as PrismaClientModule from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockOauthStateCreate = vi.fn()
const mockOauthStateFindUnique = vi.fn()
const mockOauthStateUpdateMany = vi.fn()
const mockBootstrapDisconnect = vi.fn()

// GoogleDriveOAuthService owns a dedicated bootstrap PrismaClient for the
// no-RLS google_drive_oauth_states table (INV-4 — mirrors TenantBootstrapService).
// Mock the module-level constructor rather than injecting PrismaService.
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof PrismaClientModule>()
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => ({
      googleDriveOAuthState: {
        create: mockOauthStateCreate,
        findUnique: mockOauthStateFindUnique,
        updateMany: mockOauthStateUpdateMany,
      },
      $disconnect: mockBootstrapDisconnect,
    })),
  }
})

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'
import type { KeyManagementService } from '../kms/kms.interface'

import type { GoogleDriveApiClient } from './google-drive-api.client'
import { GoogleDriveOAuthService } from './google-drive-oauth.service'

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    google: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://worker.example/integrations/google-drive/callback',
    },
    storage: { signedUrlExpiry: 900 },
    auth: { jwtAccessSecret: 'test-secret' },
    ...overrides,
  }
  return { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService
}

const staffUser: AuthenticatedUser = {
  userId: 'user-1',
  firmId: 'firm-1',
  role: UserRole.ASSOCIATE,
  sessionState: 'full',
  sessionType: 'staff',
  jti: 'jti',
}

describe('GoogleDriveOAuthService', () => {
  const prisma = {
    googleDriveOAuthState: {
      create: mockOauthStateCreate,
      findUnique: mockOauthStateFindUnique,
      updateMany: mockOauthStateUpdateMany,
    },
  }
  let withRlsContextMock: ReturnType<typeof vi.fn>
  let apiClient: Pick<
    GoogleDriveApiClient,
    'buildAuthUrl' | 'exchangeCode' | 'getUserInfo' | 'ensureFolderPath' | 'revokeToken' | 'refreshAccessToken'
  >
  let kms: {
    generateDataKey: ReturnType<typeof vi.fn>
    unwrapDataKey: ReturnType<typeof vi.fn>
    encryptWithDataKey: ReturnType<typeof vi.fn>
    decryptWithDataKey: ReturnType<typeof vi.fn>
  }
  let audit: { log: ReturnType<typeof vi.fn> }
  let service: GoogleDriveOAuthService

  beforeEach(() => {
    vi.clearAllMocks()
    withRlsContextMock = vi.fn()
    apiClient = {
      buildAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=1'),
      exchangeCode: vi.fn(),
      getUserInfo: vi.fn(),
      ensureFolderPath: vi.fn(),
      revokeToken: vi.fn(),
      refreshAccessToken: vi.fn(),
    }
    kms = {
      generateDataKey: vi.fn().mockResolvedValue({ plaintext: Buffer.alloc(32), wrapped: 'wrapped' }),
      unwrapDataKey: vi.fn().mockResolvedValue(Buffer.alloc(32)),
      encryptWithDataKey: vi.fn().mockResolvedValue('ciphertext'),
      decryptWithDataKey: vi.fn().mockResolvedValue(Buffer.from('refresh-token-plain', 'utf8')),
    }
    audit = { log: vi.fn() }

    service = new GoogleDriveOAuthService(
      { withRlsContext: withRlsContextMock } as unknown as PrismaRlsClient,
      apiClient as unknown as GoogleDriveApiClient,
      kms as unknown as KeyManagementService,
      audit as unknown as AuditService,
      makeConfig(),
    )
  })

  it('issues a single-use state token and returns a Google consent URL', async () => {
    const result = await service.startConnect(staffUser, {})
    const createArgs = mockOauthStateCreate.mock.calls[0]?.[0] as
      | { data: { firmId: string; userId: string } }
      | undefined
    expect(createArgs?.data.firmId).toBe('firm-1')
    expect(createArgs?.data.userId).toBe('user-1')
    expect(result.authUrl).toContain('accounts.google.com')
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'integration.google_drive.connect_started' }),
    )
  })

  it('rejects a callback with an unknown state token (no DB row)', async () => {
    prisma.googleDriveOAuthState.findUnique.mockResolvedValue(null)

    const result = await service.handleCallback({ code: 'auth-code', state: 'bogus-state' })

    expect(result.redirectUrl).toContain('gdriveError=invalid_state')
    expect(apiClient.exchangeCode).not.toHaveBeenCalled()
  })

  it('rejects an expired state token and audits the rejection', async () => {
    prisma.googleDriveOAuthState.findUnique.mockResolvedValue({
      id: 'state-1',
      firmId: 'firm-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 60_000),
      consumedAt: null,
    })
    prisma.googleDriveOAuthState.updateMany.mockResolvedValue({ count: 1 })

    const result = await service.handleCallback({ code: 'auth-code', state: 'state-1' })

    expect(result.redirectUrl).toContain('gdriveError=state_expired')
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'integration.google_drive.oauth_state_rejected',
        payload: { reason: 'expired' },
      }),
    )
    expect(apiClient.exchangeCode).not.toHaveBeenCalled()
  })

  it('rejects a replayed (already-consumed) state token — single use enforced atomically', async () => {
    prisma.googleDriveOAuthState.findUnique.mockResolvedValue({
      id: 'state-1',
      firmId: 'firm-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    })
    // Simulates a concurrent request having already won the atomic consume race.
    prisma.googleDriveOAuthState.updateMany.mockResolvedValue({ count: 0 })

    const result = await service.handleCallback({ code: 'auth-code', state: 'state-1' })

    expect(result.redirectUrl).toContain('gdriveError=state_reused')
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'integration.google_drive.oauth_state_rejected',
        payload: { reason: 'consumed' },
      }),
    )
    expect(apiClient.exchangeCode).not.toHaveBeenCalled()
  })

  it('completes the connect flow: encrypts the refresh token and bootstraps folders', async () => {
    prisma.googleDriveOAuthState.findUnique.mockResolvedValue({
      id: 'state-1',
      firmId: 'firm-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    })
    prisma.googleDriveOAuthState.updateMany.mockResolvedValue({ count: 1 })
    ;(apiClient.exchangeCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresInSeconds: 3600,
      scope: 'drive.file',
    })
    ;(apiClient.getUserInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: 'staff@example.com',
    })
    ;(apiClient.ensureFolderPath as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'root-folder-id',
      name: 'Clients',
    })

    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        googleDriveConnection: {
          findFirst: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ id: 'conn-1', isDefault: true }),
          update: vi.fn().mockResolvedValue({ id: 'conn-1' }),
        },
      }
      return fn(tx)
    })

    const result = await service.handleCallback({ code: 'auth-code', state: 'state-1' })

    expect(result.redirectUrl).toContain('gdriveConnected=1')
    expect(kms.generateDataKey).toHaveBeenCalled()
    expect(kms.encryptWithDataKey).toHaveBeenCalled()
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'integration.google_drive.connected' }),
    )
    // The plaintext refresh token must never reach the audit log payload.
    const calls = audit.log.mock.calls.flat()
    expect(JSON.stringify(calls)).not.toContain('refresh-token')
  })

  it('resolveStorageOwner falls back to the firm default connection when no owner requested', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        googleDriveConnection: {
          findFirst: vi.fn().mockResolvedValue({ userId: 'default-owner', status: 'CONNECTED' }),
        },
      }
      return fn(tx)
    })

    const owner = await service.resolveStorageOwner('firm-1')
    expect(owner).toBe('default-owner')
  })

  it('resolveStorageOwner throws when nobody in the firm has connected Google Drive', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        googleDriveConnection: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }
      return fn(tx)
    })

    await expect(service.resolveStorageOwner('firm-1', 'some-user')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    )
  })

  it('getAccessContext marks the connection ERROR and throws when token refresh fails', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'conn-1' })
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        googleDriveConnection: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'conn-1',
            status: 'CONNECTED',
            encryptedRefreshToken: 'ciphertext',
            wrappedDataKey: 'wrapped',
            rootFolderId: 'root-1',
          }),
          update,
        },
      }
      return fn(tx)
    })
    ;(apiClient.refreshAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('invalid_grant'),
    )

    await expect(service.getAccessContext('firm-1', 'user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    const updateArg = update.mock.calls[0]?.[0] as { data: { status: string; lastErrorMessage: string } }
    expect(updateArg.data.status).toBe('ERROR')
    expect(updateArg.data.lastErrorMessage).toBe('invalid_grant')
  })

  it('getAccessContext refuses a revoked connection', async () => {
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        googleDriveConnection: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'conn-1',
            status: 'REVOKED',
            encryptedRefreshToken: null,
            rootFolderId: 'root-1',
            wrappedDataKey: 'wrapped',
          }),
        },
      }
      return fn(tx)
    })

    await expect(service.getAccessContext('firm-1', 'user-1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    )
  })

  it('disconnect only ever targets the authenticated caller\'s own connection row', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'conn-1',
      status: 'CONNECTED',
      encryptedRefreshToken: 'ciphertext',
      wrappedDataKey: 'wrapped',
    })
    const update = vi.fn().mockResolvedValue({ id: 'conn-1' })
    withRlsContextMock.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { googleDriveConnection: { findUnique, update } }
      return fn(tx)
    })

    await service.disconnect(staffUser, {})

    expect(findUnique).toHaveBeenCalledWith({
      where: { firmId_userId: { firmId: staffUser.firmId, userId: staffUser.userId } },
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conn-1' } }),
    )
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'integration.google_drive.disconnected' }),
    )
  })
})
