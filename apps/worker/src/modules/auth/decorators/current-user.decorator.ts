import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator, UnauthorizedException } from '@nestjs/common'

import type { AuthenticatedUser } from '../auth.types'

interface RequestWithUser {
  user?: AuthenticatedUser
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>()
    if (!request.user) {
      throw new UnauthorizedException({
        type: 'https://taxdesk.pk/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
      })
    }
    return request.user
  },
)
