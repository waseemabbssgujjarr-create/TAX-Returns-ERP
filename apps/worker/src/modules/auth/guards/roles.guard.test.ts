import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { ROLES_KEY } from '../decorators/roles.decorator'

import { RolesGuard } from './roles.guard'

function mockContext(method: string, role: UserRole, handlerRoles?: UserRole[]) {
  const reflector = new Reflector()
  reflector.getAllAndOverride = (key: string) => {
    if (key === ROLES_KEY) {
      return handlerRoles
    }
    return undefined
  }

  const guard = new RolesGuard(reflector)
  const handler = () => undefined
  if (handlerRoles) {
    Reflect.defineMetadata(ROLES_KEY, handlerRoles, handler)
  }

  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        user: {
          userId: 'u',
          firmId: 'f',
          role,
          sessionState: 'full',
          sessionType: 'staff',
          jti: 'j',
        },
      }),
    }),
  }

  return { guard, context: context as never }
}

describe('RolesGuard', () => {
  it('denies REVIEWER on POST unless explicitly allowed', () => {
    const { guard, context } = mockContext('POST', UserRole.REVIEWER)
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  it('allows REVIEWER on POST when @Roles includes REVIEWER', () => {
    const { guard, context } = mockContext('POST', UserRole.REVIEWER, [UserRole.REVIEWER])
    expect(guard.canActivate(context)).toBe(true)
  })

  it('allows REVIEWER on GET', () => {
    const { guard, context } = mockContext('GET', UserRole.REVIEWER)
    expect(guard.canActivate(context)).toBe(true)
  })
})
