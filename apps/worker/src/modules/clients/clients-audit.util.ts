import type { AuditEntry } from '../audit/audit-entry.types'
import type { AuthenticatedUser, RequestMeta } from '../auth/auth.types'

export function clientAuditBase(
  user: AuthenticatedUser,
  meta: RequestMeta,
): Pick<AuditEntry, 'firmId' | 'userId' | 'ipAddress' | 'userAgent'> {
  return {
    firmId: user.firmId,
    userId: user.userId,
    ...(meta.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  } as Pick<AuditEntry, 'firmId' | 'userId' | 'ipAddress' | 'userAgent'>
}
