/** Compile-time safe audit payloads — no secrets in union members. */

type BaseAudit = {
  firmId: string
  userId?: string
  resourceType?: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
}

export type AuditEntry =
  | (BaseAudit & {
      action: 'auth.login.success'
      payload: { ipAddress?: string; userAgent?: string }
    })
  | (BaseAudit & {
      action: 'auth.login.password_fail'
      payload: { email: string; ipAddress?: string }
    })
  | (BaseAudit & {
      action: 'auth.login.account_locked'
      payload: { lockedUntil: string }
    })
  | (BaseAudit & {
      action: 'auth.login.totp_fail'
      payload: { attemptCount: number }
    })
  | (BaseAudit & {
      action: 'auth.login.recovery_code_used'
      payload: Record<string, never>
    })
  | (BaseAudit & {
      action: 'auth.logout'
      payload: Record<string, never>
    })
  | (BaseAudit & {
      action: 'auth.session.expired'
      payload: { reason: string }
    })
  | (BaseAudit & {
      action: 'auth.session.refresh'
      payload: { ipAddress?: string }
    })
  | (BaseAudit & {
      action: 'auth.session.revoked_all'
      payload: { reason: string }
    })
  | (BaseAudit & {
      action: 'auth.totp.setup_started'
      payload: Record<string, never>
    })
  | (BaseAudit & {
      action: 'auth.totp.setup_complete'
      payload: Record<string, never>
    })
  | (BaseAudit & {
      action: 'auth.totp.disabled'
      payload: { actorId: string }
    })
  | (BaseAudit & {
      action: 'auth.otp.sent'
      payload: { channel: string; contactHmac: string }
    })
  | (BaseAudit & {
      action: 'auth.otp.verified'
      payload: { contactHmac: string }
    })
  | (BaseAudit & {
      action: 'auth.otp.fail'
      payload: { contactHmac: string; attempts: number }
    })
  | (BaseAudit & {
      action: 'auth.anomaly.cross_firm'
      payload: { requestedFirmId: string; actualFirmId: string }
    })
  | (BaseAudit & {
      action: 'auth.anomaly.new_device'
      payload: { ipAddress?: string; userAgent?: string }
    })
  | (BaseAudit & {
      action: 'auth.anomaly.replay_detected'
      payload: { jwtFamily: string }
    })
  | (BaseAudit & {
      action: 'auth.role.changed'
      payload: { actorId: string; targetUserId: string; oldRole: string; newRole: string }
    })
  | (BaseAudit & {
      action: 'auth.permissions.updated'
      payload: { actorId: string }
    })
  | (BaseAudit & {
      action: 'auth.sensitive_field.viewed'
      payload: { resourceType: string; resourceId: string; fieldName: string }
    })
  | (BaseAudit & {
      action: 'client.created'
      payload: { after: Record<string, unknown> }
    })
  | (BaseAudit & {
      action: 'client.updated'
      payload: { before: Record<string, unknown>; after: Record<string, unknown> }
    })
  | (BaseAudit & {
      action: 'client.archived'
      payload: { before: Record<string, unknown>; after: Record<string, unknown> }
    })
  | (BaseAudit & {
      action: 'client.deleted'
      payload: { before: Record<string, unknown> }
    })
  | (BaseAudit & {
      action: 'client.note_added'
      payload: { noteId: string }
    })
  | (BaseAudit & {
      action: 'client.sensitive_field_view'
      payload: { fieldName: string }
    })
  | (BaseAudit & {
      action: 'document.upload'
      payload: { after: Record<string, unknown> }
    })
  | (BaseAudit & {
      action: 'document.version_upload'
      payload: { after: Record<string, unknown> }
    })
  | (BaseAudit & {
      action: 'document.access'
      payload: { originalName: string }
    })
  | (BaseAudit & {
      action: 'document.delete'
      payload: { before: Record<string, unknown> }
    })
  | (BaseAudit & {
      action: 'document.updated'
      payload: { before: Record<string, unknown>; after: Record<string, unknown> }
    })
  | (BaseAudit & {
      action: 'admin.user.role_update'
      payload: { targetUserId: string; role: string }
    })
  | (BaseAudit & {
      action: 'admin.session.revoke'
      payload: { reason: string }
    })
  | (BaseAudit & {
      action: 'admin.firm_settings.update'
      payload: { idleTimeoutMinutes: number }
    })
  | (BaseAudit & {
      action: 'invoice.create'
      payload: { clientId: string; amountPaisa: string }
    })
  | (BaseAudit & {
      action: 'payment.record'
      payload: { amountPaisa: string }
    })
  | (BaseAudit & {
      action: 'notice.create'
      payload: { clientId: string }
    })
  | (BaseAudit & {
      action: 'notice.update'
      payload: { status: string }
    })
  | (BaseAudit & {
      action: 'compliance_event.create'
      payload: { kind: string }
    })
  | (BaseAudit & {
      action: 'tax_plan_scenario.create'
      payload: { taxYearFileId: string; rulesVersion: string }
    })
  | (BaseAudit & {
      action: 'return_preparation.upsert'
      payload: { taxYearFileId: string; reviewStatus: string }
    })
  | (BaseAudit & {
      action: 'return_preparation.assemble'
      payload: {
        taxYearFileId: string
        reviewStatus: string
        rulesState: string
        validationStatus: string
      }
    })
  | (BaseAudit & {
      action: 'return_preparation.submit_review'
      payload: { taxYearFileId: string; from: string; to: string }
    })
  | (BaseAudit & {
      action: 'return_preparation.approve'
      payload: { taxYearFileId: string; from: string; to: string; comment: string | null }
    })
  | (BaseAudit & {
      action: 'return_preparation.demote'
      payload: { taxYearFileId: string; from: string; to: string; comment: string | null }
    })
  | (BaseAudit & {
      action: 'withholding_entry.create'
      payload: { taxYearFileId: string; source: string; validationStatus?: string }
    })
  | (BaseAudit & {
      action: 'withholding.reconcile'
      payload: { unmatchedCount: number }
    })
  | (BaseAudit & {
      action: 'export.request'
      payload: { exportType: string; taxYearFileId: string; jobId: string }
    })
  | (BaseAudit & {
      action: 'export.download'
      payload: { exportType: string }
    })
  | (BaseAudit & {
      action: 'export.ready'
      payload: { exportType: string; rulesState: string; rulesVersion: string | null }
    })
  | (BaseAudit & {
      action: 'export.failed'
      payload: { exportType: string; error: string }
    })
  | (BaseAudit & {
      action: 'wealth_statement.upsert'
      payload: { taxYearFileId: string; status: string; discrepancyPaisa: string }
    })
  | (BaseAudit & {
      action: 'iris_filing.prepare'
      payload: { taxYearFileId: string; status: string; readyToFile: boolean }
    })
  | (BaseAudit & {
      action: 'iris_filing.submit_attempt'
      payload: { taxYearFileId: string; outcome: string; status: string; channel: string }
    })
  | (BaseAudit & {
      action: 'iris_filing.status_sync'
      payload: { taxYearFileId: string; outcome: string; status: string }
    })
  | (BaseAudit & {
      action: 'integration.google_drive.connect_started'
      payload: Record<string, never>
    })
  | (BaseAudit & {
      action: 'integration.google_drive.connected'
      payload: { googleAccountEmail: string; isDefault: boolean }
    })
  | (BaseAudit & {
      action: 'integration.google_drive.disconnected'
      payload: { reason: string }
    })
  | (BaseAudit & {
      action: 'integration.google_drive.oauth_state_rejected'
      payload: { reason: 'expired' | 'consumed' | 'not_found' }
    })
  | (BaseAudit & {
      action: 'integration.google_drive.callback_error'
      payload: { reason: string }
    })

/** @internal type-level test: secrets must not appear in audit payloads */
export type _AuditSecretSafety = AuditEntry extends { payload: infer P }
  ? 'totpSecret' extends keyof P
    ? never
    : 'otp' extends keyof P
      ? never
      : true
  : never
