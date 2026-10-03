import { rlsIdentityStorage } from '../../database/rls-context.store'

/** Placeholder user id for pre-auth tenant-scoped operations (login, OTP send). */
export const PRE_AUTH_USER_ID = '00000000-0000-0000-0000-000000000001'

export async function withStaffBootstrapContext<T>(
  firmId: string,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return rlsIdentityStorage.run({ firmId, userId, sessionType: 'staff' }, fn)
}
