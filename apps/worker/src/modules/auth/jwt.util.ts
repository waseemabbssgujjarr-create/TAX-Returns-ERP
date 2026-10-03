import { UnauthorizedException } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'

import type { JwtPayload, AuthenticatedUser } from './auth.types'

const JWT_ALGORITHMS = ['HS256'] as const

export function verifyAccessToken(jwtService: JwtService, token: string): JwtPayload {
  try {
    const payload = jwtService.verify<JwtPayload>(token, {
      algorithms: [...JWT_ALGORITHMS],
    })
    return payload
  } catch {
    throw new UnauthorizedException({
      type: 'https://taxdesk.pk/problems/unauthorized',
      title: 'Unauthorized',
      status: 401,
    })
  }
}

export function payloadToAuthenticatedUser(payload: JwtPayload): AuthenticatedUser {
  return {
    userId: payload.sub,
    firmId: payload.firmId,
    role: payload.role,
    sessionState: payload.sessionState,
    sessionType: payload.sessionType,
    jti: payload.jti,
    ...(payload.clientId !== undefined ? { clientId: payload.clientId } : {}),
  }
}

export function extractBearerToken(authorization?: string): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }
  return authorization.slice('Bearer '.length).trim()
}
