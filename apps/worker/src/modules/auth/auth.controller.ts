import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import 'cookie-parser'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { PrismaRlsClient } from '../../database/prisma-rls.client'

import { AuthSessionService } from './auth-session.service'
import { InvalidRefreshTokenError, ReplayAttackError } from './auth.errors'
import { AuthService } from './auth.service'
import type { AuthenticatedUser } from './auth.types'
import { REFRESH_COOKIE_NAME, requestMeta } from './auth.types'
import { clearRefreshTokenCookie, setRefreshTokenCookie } from './cookie.helper'
import { AllowPartialSession } from './decorators/allow-partial-session.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'
import {
  LoginSchema,
  OtpSendSchema,
  OtpVerifySchema,
  TotpSetupConfirmSchema,
  TotpVerifySchema,
  type LoginBody,
  type OtpSendBody,
  type OtpVerifyBody,
  type TotpSetupConfirmBody,
  type TotpVerifyBody,
} from './dto/auth.dto'
import { extractBearerToken } from './jwt.util'
import { OtpService } from './otp.service'
import { withStaffBootstrapContext } from './rls-bootstrap.util'
import { TokenService } from './token.service'
import { TotpService } from './totp.service'

interface RequestWithUser extends Request {
  user?: AuthenticatedUser
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSession: AuthSessionService,
    private readonly tokenService: TokenService,
    private readonly totpService: TotpService,
    private readonly otpService: OtpService,
    private readonly prismaRls: PrismaRlsClient,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 900_000 } })
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() body: LoginBody, @Req() req: Request) {
    return this.authService.login(body, requestMeta(req))
  }

  @Public()
  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @UsePipes(new ZodValidationPipe(TotpVerifySchema))
  async verifyTotp(
    @Body() body: TotpVerifyBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = extractBearerToken(req.headers.authorization)
    if (!token) {
      throw new UnauthorizedException({
        type: 'https://taxdesk.pk/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
      })
    }

    const payload = this.tokenService.verifyPayload(token)
    const totpBody = {
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.recoveryCode !== undefined ? { recoveryCode: body.recoveryCode } : {}),
    }
    const session = await this.authSession.verifyTotpAndIssueSession(
      payload,
      totpBody,
      requestMeta(req),
    )
    setRefreshTokenCookie(res, session.rawRefreshToken)
    return { accessToken: session.accessToken }
  }

  @AllowPartialSession()
  @Post('totp/setup/initiate')
  @HttpCode(HttpStatus.OK)
  async initiateTotpSetup(@CurrentUser() user: AuthenticatedUser) {
    const emailUser = await withStaffBootstrapContext(user.firmId, user.userId, () =>
      this.prismaRls.withRlsContext(async (tx) =>
        tx.user.findUnique({ where: { id: user.userId }, select: { email: true } }),
      ),
    )
    if (!emailUser?.email) {
      throw new UnauthorizedException()
    }
    return this.totpService.initiateSetup(user.userId, user.firmId, emailUser.email)
  }

  @AllowPartialSession()
  @Post('totp/setup/confirm')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(TotpSetupConfirmSchema))
  confirmTotpSetup(@Body() body: TotpSetupConfirmBody, @CurrentUser() user: AuthenticatedUser) {
    return this.totpService.confirmSetup(user.userId, user.firmId, body.code)
  }

  @AllowPartialSession()
  @Post('totp/setup/complete')
  @HttpCode(HttpStatus.OK)
  async completeTotpSetup(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authSession.issueFullStaffSession(
      user.userId,
      user.firmId,
      requestMeta(req),
    )
    setRefreshTokenCookie(res, session.rawRefreshToken)
    return { accessToken: session.accessToken }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string | undefined> | undefined
    const raw = cookies?.[REFRESH_COOKIE_NAME]
    if (!raw) {
      throw new UnauthorizedException({
        type: 'https://taxdesk.pk/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        reason: 'invalid_refresh_token',
      })
    }

    try {
      const rotated = await this.tokenService.rotateRefreshToken(
        raw,
        req.ip,
        req.headers['user-agent'],
      )
      setRefreshTokenCookie(res, rotated.rawToken)
      return { accessToken: rotated.accessToken }
    } catch (err) {
      if (err instanceof ReplayAttackError || err instanceof InvalidRefreshTokenError) {
        clearRefreshTokenCookie(res)
        throw new UnauthorizedException({
          type: 'https://taxdesk.pk/problems/unauthorized',
          title: 'Unauthorized',
          status: 401,
          reason: 'invalid_refresh_token',
        })
      }
      throw err
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string | undefined> | undefined
    const raw = cookies?.[REFRESH_COOKIE_NAME]
    if (raw) {
      await this.tokenService.revokeRefreshToken(raw)
    }
    if (req.user) {
      await withStaffBootstrapContext(req.user.firmId, req.user.userId, () =>
        this.prismaRls.withRlsContext(async (tx) => {
          await tx.auditLog.create({
            data: {
              firmId: req.user!.firmId,
              userId: req.user!.userId,
              action: 'auth.logout',
              after: {},
            },
          })
        }),
      )
    }
    clearRefreshTokenCookie(res)
    return { ok: true }
  }

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(OtpSendSchema))
  sendOtp(@Body() body: OtpSendBody, @Req() req: Request) {
    return this.otpService.sendOtp(body, requestMeta(req))
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(OtpVerifySchema))
  async verifyOtp(
    @Body() body: OtpVerifyBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.otpService.verifyOtp(body, requestMeta(req))
    setRefreshTokenCookie(res, result.rawRefreshToken)
    return { accessToken: result.accessToken }
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const data = await withStaffBootstrapContext(user.firmId, user.userId, () =>
      this.prismaRls.withRlsContext(async (tx) => {
        const row = await tx.user.findUnique({
          where: { id: user.userId },
          select: {
            id: true,
            name: true,
            role: true,
            firmId: true,
            totpEnabled: true,
            firm: { select: { name: true, idleTimeoutMinutes: true } },
          },
        })
        return row
      }),
    )

    if (!data) {
      throw new UnauthorizedException()
    }

    return {
      user: {
        id: data.id,
        name: data.name,
        role: data.role,
        firmId: data.firmId,
        totpEnabled: data.totpEnabled,
      },
      firm: {
        name: data.firm.name,
        idleTimeoutMinutes: data.firm.idleTimeoutMinutes,
      },
    }
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  passwordResetStub() {
    throw new NotImplementedException({
      type: 'https://taxdesk.pk/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
    })
  }
}
