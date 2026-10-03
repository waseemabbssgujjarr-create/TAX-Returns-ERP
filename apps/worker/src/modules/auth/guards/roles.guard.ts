import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@prisma/client'

import type { AuthenticatedUser } from '../auth.types'
import { ROLES_KEY } from '../decorators/roles.decorator'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

interface HttpRequest {
  method: string
  user?: AuthenticatedUser
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const request = context.switchToHttp().getRequest<HttpRequest>()
    const user = request.user
    if (!user) {
      return true
    }

    if (user.role === UserRole.REVIEWER && WRITE_METHODS.has(request.method.toUpperCase())) {
      const reviewerAllowed =
        requiredRoles !== undefined && requiredRoles.includes(UserRole.REVIEWER)
      if (!reviewerAllowed) {
        throw new ForbiddenException({
          type: 'https://taxdesk.pk/problems/forbidden',
          title: 'Forbidden',
          status: 403,
        })
      }
    }

    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        type: 'https://taxdesk.pk/problems/forbidden',
        title: 'Forbidden',
        status: 403,
      })
    }

    return true
  }
}
