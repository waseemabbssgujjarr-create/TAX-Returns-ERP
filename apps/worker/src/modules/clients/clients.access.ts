import { UserRole } from '@prisma/client'

export function isFirmWideClientAccess(role: UserRole): boolean {
  return role === UserRole.OWNER || role === UserRole.MANAGER
}
