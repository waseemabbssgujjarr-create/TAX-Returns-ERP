import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { AuditService } from '../../audit/audit.service'
import type { AuthenticatedUser } from '../auth.types'
import { FIRM_ID_FROM_KEY, type FirmIdSource } from '../decorators/firm-id-from.decorator'
import { withStaffBootstrapContext } from '../rls-bootstrap.util'

interface HttpRequest {
  user?: AuthenticatedUser
  params?: Record<string, string>
  body?: Record<string, unknown>
  ip?: string
  headers: { 'user-agent'?: string }
}

@Injectable()
export class FirmGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const source = this.reflector.getAllAndOverride<FirmIdSource | undefined>(FIRM_ID_FROM_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!source) {
      return true
    }

    const request = context.switchToHttp().getRequest<HttpRequest>()
    const user = request.user
    if (!user) {
      return true
    }

    const requestedFirmId = this.extractFirmId(source, request)
    if (!requestedFirmId || requestedFirmId === user.firmId) {
      return true
    }

    const auditEntry = {
      action: 'auth.anomaly.cross_firm' as const,
      firmId: user.firmId,
      userId: user.userId,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(request.headers['user-agent'] !== undefined
        ? { userAgent: request.headers['user-agent'] }
        : {}),
      payload: {
        requestedFirmId,
        actualFirmId: user.firmId,
      },
    }
    await withStaffBootstrapContext(user.firmId, user.userId, () => this.audit.log(auditEntry))

    throw new NotFoundException({
      type: 'https://taxdesk.pk/problems/not-found',
      title: 'Not found',
      status: 404,
    })
  }

  private extractFirmId(source: FirmIdSource, request: HttpRequest): string | undefined {
    if (source === 'param.firmId') {
      return request.params?.['firmId']
    }
    const bodyFirmId = request.body?.['firmId']
    return typeof bodyFirmId === 'string' ? bodyFirmId : undefined
  }
}
