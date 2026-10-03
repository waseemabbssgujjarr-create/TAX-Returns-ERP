import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { DatabaseModule } from '../../database/database.module'
import { AuditModule } from '../audit/audit.module'
import { KmsModule } from '../kms/kms.module'
import { NotificationModule } from '../notifications/notification.module'

import { AuthSessionService } from './auth-session.service'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { FirmGuard } from './guards/firm.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { OtpService } from './otp.service'
import { PortalClientLookup } from './portal-client.lookup'
import { TenantBootstrapService } from './tenant-bootstrap.service'
import { TokenService } from './token.service'
import { TotpService } from './totp.service'

@Module({
  imports: [
    DatabaseModule,
    KmsModule,
    AuditModule,
    NotificationModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env['JWT_ACCESS_SECRET']
        if (!secret) {
          throw new Error('JWT_ACCESS_SECRET is required')
        }
        return {
          secret,
          signOptions: {
            expiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
            algorithm: 'HS256' as const,
          },
        }
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    TokenService,
    TotpService,
    OtpService,
    TenantBootstrapService,
    PortalClientLookup,
    FirmGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [TokenService, TenantBootstrapService],
})
export class AuthModule {}
