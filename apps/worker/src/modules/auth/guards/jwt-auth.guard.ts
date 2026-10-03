import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'

import { PrismaRlsClient } from '../../../database/prisma-rls.client'
import { rlsIdentityStorage } from '../../../database/rls-context.store'
import type { AuthenticatedUser, JwtPayload } from '../auth.types'
import { ALLOW_PARTIAL_SESSION_KEY } from '../decorators/allow-partial-session.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { extractBearerToken, payloadToAuthenticatedUser } from '../jwt.util'

interface HttpRequest {
  headers: { authorization?: string }
  user?: AuthenticatedUser
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PrismaRlsClient) private readonly prismaRls: PrismaRlsClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const allowPartial = this.reflector.getAllAndOverride<boolean>(ALLOW_PARTIAL_SESSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const request = context.switchToHttp().getRequest<HttpRequest>()
    const token = extractBearerToken(request.headers.authorization)
    if (!token) {
      throw this.unauthorized()
    }

    let payload: JwtPayload
    try {
      payload = this.jwtService.verify<JwtPayload>(token, { algorithms: ['HS256'] })
    } catch {
      throw this.unauthorized()
    }

    if (payload.sessionState === 'partial' && !allowPartial) {
      throw this.unauthorized()
    }

    const identity = {
      firmId: payload.firmId,
      userId: payload.sub,
      sessionType: payload.sessionType,
      ...(payload.clientId !== undefined ? { clientId: payload.clientId } : {}),
    }

    const userActive = await rlsIdentityStorage.run(identity, async () =>
      this.prismaRls.withRlsContext(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: payload.sub },
          select: {
            isActive: true,
            passwordChangedAt: true,
          },
        })
        if (!user?.isActive) {
          return false
        }
        if (user.passwordChangedAt) {
          const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000)
          if (changedAtSec > payload.iat) {
            return false
          }
        }
        return true
      }),
    )

    if (!userActive) {
      throw this.unauthorized()
    }

    request.user = payloadToAuthenticatedUser(payload)
    return true
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      type: 'https://taxdesk.pk/problems/unauthorized',
      title: 'Unauthorized',
      status: 401,
    })
  }
}
