import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'

import { rlsIdentityStorage, type RlsIdentity } from './rls-context.store'

/** Shape populated by JwtAuthGuard on authenticated requests */
export interface AuthenticatedRequestUser {
  firmId: string
  userId: string
  sessionType: 'staff' | 'portal'
  clientId?: string
}

interface HttpRequestWithUser {
  user?: AuthenticatedRequestUser
}

/**
 * Stores RLS identity in AsyncLocalStorage for the request lifecycle.
 * Does not open a database transaction — callers use PrismaRlsClient.withRlsContext().
 */
@Injectable()
export class RlsTransactionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestWithUser>()
    const user = request.user

    if (!user) {
      return next.handle()
    }

    const identity: RlsIdentity = {
      firmId: user.firmId,
      userId: user.userId,
      sessionType: user.sessionType,
      ...(user.clientId !== undefined ? { clientId: user.clientId } : {}),
    }

    return new Observable((subscriber) => {
      rlsIdentityStorage.run(identity, () => {
        next.handle().subscribe(subscriber)
      })
    })
  }
}
