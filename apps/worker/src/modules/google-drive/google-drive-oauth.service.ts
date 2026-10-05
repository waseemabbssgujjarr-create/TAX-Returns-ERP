import { randomBytes } from 'node:crypto'

import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaClient, UserRole } from '@prisma/client'
import type { GoogleDriveConnectionSummary, GoogleDriveStatus } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { rlsIdentityStorage } from '../../database/rls-context.store'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser, RequestMeta } from '../auth/auth.types'
import { KMS_TOKEN } from '../kms/kms.interface'
import type { KeyManagementService } from '../kms/kms.interface'

import { GoogleDriveApiClient } from './google-drive-api.client'
import {
  DRIVE_CLIENTS_FOLDER_NAME,
  DRIVE_ROOT_FOLDER_NAME,
  OAUTH_STATE_TTL_SECONDS,
} from './google-drive.constants'
import type { GoogleOAuthConfig } from './google-drive.types'

export interface GoogleDriveAccessContext {
  accessToken: string
  rootFolderId: string
  ownerUserId: string
}

/**
 * Pre-auth OAuth state table (google_drive_oauth_states) has no RLS — the
 * callback arrives with no Authorization header, so identity is recovered
 * from the state row itself. This dedicated bootstrap client mirrors
 * TenantBootstrapService (INV-4 — never use the RLS-wrapped PrismaService
 * for tables that intentionally sit outside tenant-scoped RLS).
 */
@Injectable()
export class GoogleDriveOAuthService implements OnModuleDestroy {
  private readonly logger = new Logger(GoogleDriveOAuthService.name)
  private readonly prismaBootstrap = new PrismaClient({
    datasources: {
      db: {
        ...(process.env['DATABASE_URL'] !== undefined ? { url: process.env['DATABASE_URL'] } : {}),
      },
    },
  })

  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly apiClient: GoogleDriveApiClient,
    @Inject(KMS_TOKEN) private readonly kms: KeyManagementService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.prismaBootstrap.$disconnect()
  }

  // ── Connect (step 1) ────────────────────────────────────────────────────────

  async startConnect(user: AuthenticatedUser, meta: RequestMeta): Promise<{ authUrl: string }> {
    this.assertStaff(user)
    const config = this.oauthConfig()
    const state = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000)

    await this.prismaBootstrap.googleDriveOAuthState.create({
      data: { id: state, firmId: user.firmId, userId: user.userId, expiresAt },
    })

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'integration.google_drive.connect_started',
      payload: {},
      ...(meta.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
    })

    return { authUrl: this.apiClient.buildAuthUrl(config, state) }
  }

  // ── Callback (step 2 — no auth header; identity comes from the state row) ──

  async handleCallback(query: {
    code?: string
    state?: string
    error?: string
  }): Promise<{ redirectUrl: string }> {
    const settingsUrl = this.settingsRedirectBase()

    if (query.error) {
      return { redirectUrl: `${settingsUrl}?gdriveError=${encodeURIComponent(query.error)}` }
    }
    if (!query.code || !query.state) {
      return { redirectUrl: `${settingsUrl}?gdriveError=invalid_request` }
    }

    const stateRow = await this.prismaBootstrap.googleDriveOAuthState.findUnique({
      where: { id: query.state },
    })
    if (!stateRow) {
      this.logger.warn('Google Drive OAuth callback: unknown state token')
      return { redirectUrl: `${settingsUrl}?gdriveError=invalid_state` }
    }

    const now = new Date()
    // Atomic single-use consume: only one request can win the race.
    const consumed = await this.prismaBootstrap.googleDriveOAuthState.updateMany({
      where: { id: stateRow.id, consumedAt: null },
      data: { consumedAt: now },
    })
    const replay = consumed.count === 0
    const expired = stateRow.expiresAt.getTime() < now.getTime()

    if (replay || expired) {
      await this.audit.log({
        firmId: stateRow.firmId,
        userId: stateRow.userId,
        action: 'integration.google_drive.oauth_state_rejected',
        payload: { reason: replay ? 'consumed' : 'expired' },
      })
      return {
        redirectUrl: `${settingsUrl}?gdriveError=${replay ? 'state_reused' : 'state_expired'}`,
      }
    }

    try {
      const config = this.oauthConfig()
      const tokens = await this.apiClient.exchangeCode(config, query.code)
      if (!tokens.refreshToken) {
        throw new Error(
          'missing_refresh_token — Google omitted a refresh token; revoke app access at ' +
            'myaccount.google.com/permissions and reconnect',
        )
      }
      const userInfo = await this.apiClient.getUserInfo(tokens.accessToken)

      const { plaintext: dataKey, wrapped } = await this.kms.generateDataKey()
      const encryptedRefreshToken = await this.kms.encryptWithDataKey(
        dataKey,
        Buffer.from(tokens.refreshToken, 'utf8'),
      )

      const identity = {
        firmId: stateRow.firmId,
        userId: stateRow.userId,
        sessionType: 'staff' as const,
      }

      const connection = await rlsIdentityStorage.run(identity, () =>
        this.prismaRls.withRlsContext(async (tx) => {
          const existingDefault = await tx.googleDriveConnection.findFirst({
            where: { firmId: stateRow.firmId, isDefault: true },
            select: { id: true },
          })
          return tx.googleDriveConnection.upsert({
            where: { firmId_userId: { firmId: stateRow.firmId, userId: stateRow.userId } },
            create: {
              firmId: stateRow.firmId,
              userId: stateRow.userId,
              googleAccountEmail: userInfo.email,
              scope: tokens.scope,
              wrappedDataKey: wrapped,
              encryptedRefreshToken,
              status: 'CONNECTED',
              isDefault: !existingDefault,
            },
            update: {
              googleAccountEmail: userInfo.email,
              scope: tokens.scope,
              wrappedDataKey: wrapped,
              encryptedRefreshToken,
              status: 'CONNECTED',
              revokedAt: null,
              lastErrorMessage: null,
            },
          })
        }),
      )

      const root = await this.apiClient.ensureFolderPath(tokens.accessToken, [
        DRIVE_ROOT_FOLDER_NAME,
        DRIVE_CLIENTS_FOLDER_NAME,
      ])

      await rlsIdentityStorage.run(identity, () =>
        this.prismaRls.withRlsContext((tx) =>
          tx.googleDriveConnection.update({
            where: { id: connection.id },
            data: { rootFolderId: root.id, lastSyncedAt: new Date() },
          }),
        ),
      )

      await this.audit.log({
        firmId: stateRow.firmId,
        userId: stateRow.userId,
        action: 'integration.google_drive.connected',
        payload: { googleAccountEmail: userInfo.email, isDefault: connection.isDefault },
      })

      return { redirectUrl: `${settingsUrl}?gdriveConnected=1` }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown_error'
      this.logger.error(`Google Drive connect failed: ${reason}`)
      await this.audit.log({
        firmId: stateRow.firmId,
        userId: stateRow.userId,
        action: 'integration.google_drive.callback_error',
        payload: { reason },
      })
      return { redirectUrl: `${settingsUrl}?gdriveError=connect_failed` }
    }
  }

  // ── Disconnect ───────────────────────────────────────────────────────────────

  async disconnect(user: AuthenticatedUser, meta: RequestMeta): Promise<{ disconnected: true }> {
    this.assertStaff(user)

    const existing = await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveConnection.findUnique({
        where: { firmId_userId: { firmId: user.firmId, userId: user.userId } },
      }),
    )
    if (!existing || existing.status === 'REVOKED') {
      throw new NotFoundException({ title: 'No active Google Drive connection' })
    }

    if (existing.encryptedRefreshToken) {
      try {
        const dataKey = await this.kms.unwrapDataKey(existing.wrappedDataKey)
        const refreshToken = (
          await this.kms.decryptWithDataKey(dataKey, existing.encryptedRefreshToken)
        ).toString('utf8')
        await this.apiClient.revokeToken(refreshToken)
      } catch (err) {
        this.logger.warn(
          `Best-effort Google token revoke failed: ${err instanceof Error ? err.message : 'unknown'}`,
        )
      }
    }

    await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveConnection.update({
        where: { id: existing.id },
        data: {
          status: 'REVOKED',
          encryptedRefreshToken: null,
          revokedAt: new Date(),
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'integration.google_drive.disconnected',
      payload: { reason: 'user_initiated' },
      ...(meta.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
    })

    return { disconnected: true }
  }

  // ── Status / oversight ───────────────────────────────────────────────────────

  async getStatus(user: AuthenticatedUser): Promise<GoogleDriveStatus> {
    this.assertStaff(user)
    const row = await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveConnection.findUnique({
        where: { firmId_userId: { firmId: user.firmId, userId: user.userId } },
      }),
    )
    if (!row) {
      return {
        connected: false,
        status: null,
        googleAccountEmail: null,
        connectedAt: null,
        lastSyncedAt: null,
        isDefault: false,
        lastErrorMessage: null,
      }
    }
    return {
      connected: row.status === 'CONNECTED',
      status: row.status,
      googleAccountEmail: row.googleAccountEmail,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      isDefault: row.isDefault,
      lastErrorMessage: row.lastErrorMessage,
    }
  }

  async listConnections(user: AuthenticatedUser): Promise<{ items: GoogleDriveConnectionSummary[] }> {
    this.assertAdminRead(user)
    const rows = await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveConnection.findMany({
        where: { firmId: user.firmId },
        orderBy: { connectedAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
    )
    return {
      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name,
        userEmail: r.user.email,
        googleAccountEmail: r.googleAccountEmail,
        status: r.status,
        isDefault: r.isDefault,
        connectedAt: r.connectedAt.toISOString(),
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      })),
    }
  }

  // ── Internal — used by GoogleDriveStorageAdapter ────────────────────────────

  /** Resolves which user's Drive owns new writes when no explicit owner is set (portal uploads). */
  async resolveStorageOwner(firmId: string, requestedUserId?: string): Promise<string> {
    if (requestedUserId) {
      const connected = await this.prismaRls.withRlsContext((tx) =>
        tx.googleDriveConnection.findUnique({
          where: { firmId_userId: { firmId, userId: requestedUserId } },
        }),
      )
      if (connected && connected.status === 'CONNECTED') {
        return requestedUserId
      }
    }

    const fallback = await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveConnection.findFirst({
        where: { firmId, isDefault: true, status: 'CONNECTED' },
      }),
    )
    if (fallback) return fallback.userId

    throw new UnprocessableEntityException({
      type: 'https://taxdesk.pk/problems/google-drive-not-connected',
      title: 'Google Drive not connected',
      status: 422,
      detail:
        'No staff member in this firm has connected Google Drive yet. ' +
        'Connect under Settings → Storage → Google Drive before uploading documents.',
    })
  }

  async getAccessContext(firmId: string, ownerUserId: string): Promise<GoogleDriveAccessContext> {
    const connection = await this.prismaRls.withRlsContext((tx) =>
      tx.googleDriveConnection.findUnique({
        where: { firmId_userId: { firmId, userId: ownerUserId } },
      }),
    )
    if (!connection || connection.status !== 'CONNECTED' || !connection.encryptedRefreshToken) {
      throw new UnprocessableEntityException({
        type: 'https://taxdesk.pk/problems/google-drive-not-connected',
        title: 'Google Drive connection unavailable',
        status: 422,
      })
    }
    if (!connection.rootFolderId) {
      throw new UnprocessableEntityException({
        type: 'https://taxdesk.pk/problems/google-drive-not-ready',
        title: 'Google Drive folder bootstrap incomplete',
        status: 422,
      })
    }

    try {
      const dataKey = await this.kms.unwrapDataKey(connection.wrappedDataKey)
      const refreshToken = (
        await this.kms.decryptWithDataKey(dataKey, connection.encryptedRefreshToken)
      ).toString('utf8')
      const config = this.oauthConfig()
      const refreshed = await this.apiClient.refreshAccessToken(config, refreshToken)
      return {
        accessToken: refreshed.accessToken,
        rootFolderId: connection.rootFolderId,
        ownerUserId,
      }
    } catch (err) {
      await this.prismaRls.withRlsContext((tx) =>
        tx.googleDriveConnection.update({
          where: { id: connection.id },
          data: {
            status: 'ERROR',
            lastErrorMessage: err instanceof Error ? err.message : 'token_refresh_failed',
          },
        }),
      )
      throw new ServiceUnavailableException({
        type: 'https://taxdesk.pk/problems/google-drive-unavailable',
        title: 'Google Drive access token refresh failed',
        status: 503,
      })
    }
  }

  // ── Guards / helpers ──────────────────────────────────────────────────────────

  private assertStaff(user: AuthenticatedUser): void {
    if (user.sessionType !== 'staff' || user.sessionState !== 'full') {
      throw new ForbiddenException({
        type: 'https://taxdesk.pk/problems/forbidden',
        title: 'Forbidden',
        status: 403,
      })
    }
  }

  private assertAdminRead(user: AuthenticatedUser): void {
    this.assertStaff(user)
    if (user.role !== UserRole.OWNER && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException({ title: 'Admin access required' })
    }
  }

  private oauthConfig(): GoogleOAuthConfig {
    const google = this.config.get<{
      clientId?: string
      clientSecret?: string
      redirectUri?: string
    }>('google')
    if (!google?.clientId || !google.clientSecret || !google.redirectUri) {
      throw new ServiceUnavailableException({
        type: 'https://taxdesk.pk/problems/google-drive-unconfigured',
        title: 'Google Drive integration is not configured on this server',
        status: 503,
      })
    }
    return {
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      redirectUri: google.redirectUri,
    }
  }

  private settingsRedirectBase(): string {
    const appUrl = (process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    )
    return `${appUrl}/en/admin/storage`
  }
}
