import { randomBytes } from 'node:crypto'

import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common'
import bcrypt from 'bcrypt'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { KMS_TOKEN, type KeyManagementService } from '../kms/kms.interface'

import { BCRYPT_OTP_COST } from './auth.constants'
import { withStaffBootstrapContext } from './rls-bootstrap.util'

const MAX_TOTP_FAILURES = 5

// ±1 step for clock skew between Playwright generators and the worker
authenticator.options = { window: 1 }

@Injectable()
export class TotpService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    @Inject(KMS_TOKEN) private readonly kms: KeyManagementService,
  ) {}

  async initiateSetup(
    userId: string,
    firmId: string,
    email: string,
  ): Promise<{ otpAuthUrl: string; qrCodeDataUrl: string; secretDisplayText: string }> {
    const secret = authenticator.generateSecret(20)

    await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) => {
        const firm = await tx.firm.findUnique({
          where: { id: firmId },
          select: { encryptedDataKey: true },
        })
        let wrappedKey = firm?.encryptedDataKey
        if (!wrappedKey) {
          const { plaintext, wrapped } = await this.kms.generateDataKey()
          wrappedKey = wrapped
          await tx.firm.update({
            where: { id: firmId },
            data: { encryptedDataKey: wrapped },
          })
          plaintext.fill(0)
        }

        const dataKey = await this.kms.unwrapDataKey(wrappedKey)
        const ciphertext = await this.kms.encryptWithDataKey(dataKey, Buffer.from(secret, 'utf8'))
        dataKey.fill(0)

        await tx.user.update({
          where: { id: userId },
          data: { totpSetupPendingSecret: ciphertext },
        })

        await tx.auditLog.create({
          data: {
            firmId,
            userId,
            action: 'auth.totp.setup_started',
            after: {},
          },
        })
      }),
    )

    const otpAuthUrl = authenticator.keyuri(email, 'TaxDeskPK', secret)
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)
    const secretDisplayText = secret.replace(/(.{4})/g, '$1 ').trim()

    return { otpAuthUrl, qrCodeDataUrl, secretDisplayText }
  }

  async confirmSetup(
    userId: string,
    firmId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const pending = await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.user.findUnique({
          where: { id: userId },
          select: { totpSetupPendingSecret: true, failedLoginCount: true, lockedUntil: true },
        }),
      ),
    )

    if (!pending?.totpSetupPendingSecret) {
      throw new UnprocessableEntityException({
        type: 'https://taxdesk.pk/problems/invalid-code',
        title: 'Invalid code.',
        status: 422,
      })
    }

    const secret = await this.decryptUserSecret(firmId, pending.totpSetupPendingSecret)
    const valid = authenticator.check(code, secret)
    if (!valid) {
      await this.recordTotpFailure(userId, firmId)
      throw new UnprocessableEntityException({
        type: 'https://taxdesk.pk/problems/invalid-code',
        title: 'Invalid code.',
        status: 422,
      })
    }

    const recoveryCodes = Array.from({ length: 10 }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    )
    const codeHashes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, BCRYPT_OTP_COST)))

    await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            totpSecret: pending.totpSetupPendingSecret,
            totpSetupPendingSecret: null,
            totpEnabled: true,
            totpVerifiedAt: new Date(),
            failedLoginCount: 0,
          },
        })

        await tx.recoveryCode.createMany({
          data: codeHashes.map((codeHash) => ({
            userId,
            firmId,
            codeHash,
          })),
        })

        await tx.auditLog.create({
          data: {
            firmId,
            userId,
            action: 'auth.totp.setup_complete',
            after: {},
          },
        })
      }),
    )

    return { recoveryCodes }
  }

  async verifyTotp(userId: string, firmId: string, code: string): Promise<boolean> {
    const user = await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.user.findUnique({
          where: { id: userId },
          select: { totpSecret: true },
        }),
      ),
    )

    if (!user?.totpSecret) {
      return false
    }

    const secret = await this.decryptUserSecret(firmId, user.totpSecret)
    const valid = authenticator.check(code, secret)
    if (!valid) {
      await this.recordTotpFailure(userId, firmId)
      return false
    }
    return true
  }

  async verifyRecoveryCode(userId: string, firmId: string, rawCode: string): Promise<boolean> {
    const normalized = rawCode.toUpperCase().trim()
    const codes = await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.recoveryCode.findMany({
          where: { userId, usedAt: null },
        }),
      ),
    )

    for (const row of codes) {
      const match = await bcrypt.compare(normalized, row.codeHash)
      if (match) {
        await withStaffBootstrapContext(firmId, userId, () =>
          this.prismaRls.withRlsContext(async (tx) => {
            await tx.recoveryCode.update({
              where: { id: row.id },
              data: { usedAt: new Date() },
            })
            await tx.auditLog.create({
              data: {
                firmId,
                userId,
                action: 'auth.login.recovery_code_used',
                after: {},
              },
            })
          }),
        )
        return true
      }
    }
    return false
  }

  private async decryptUserSecret(firmId: string, ciphertext: string): Promise<string> {
    const firm = await this.prismaRls.withPreAuthFirmContext(firmId, async (tx) =>
      tx.firm.findUnique({ where: { id: firmId }, select: { encryptedDataKey: true } }),
    )
    if (!firm?.encryptedDataKey) {
      throw new Error('Firm encryption key missing')
    }
    const dataKey = await this.kms.unwrapDataKey(firm.encryptedDataKey)
    const plain = await this.kms.decryptWithDataKey(dataKey, ciphertext)
    dataKey.fill(0)
    return plain.toString('utf8')
  }

  private async recordTotpFailure(userId: string, firmId: string): Promise<void> {
    await withStaffBootstrapContext(firmId, userId, () =>
      this.prismaRls.withRlsContext(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { failedLoginCount: true },
        })
        const failedLoginCount = (user?.failedLoginCount ?? 0) + 1
        const lockedUntil =
          failedLoginCount >= MAX_TOTP_FAILURES ? new Date(Date.now() + 30 * 60 * 1000) : null

        await tx.user.update({
          where: { id: userId },
          data: { failedLoginCount, lockedUntil },
        })

        await tx.auditLog.create({
          data: {
            firmId,
            userId,
            action: 'auth.login.totp_fail',
            after: { attemptCount: failedLoginCount },
          },
        })
      }),
    )
  }
}
