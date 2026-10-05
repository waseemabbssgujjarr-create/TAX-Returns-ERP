import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import type { Request, Response } from 'express'

import type { AuthenticatedUser } from '../auth/auth.types'
import { requestMeta } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { GoogleDriveOAuthService } from './google-drive-oauth.service'

@Controller('integrations/google-drive')
export class GoogleDriveOAuthController {
  constructor(private readonly oauth: GoogleDriveOAuthService) {}

  /** Staff-initiated connect — returns a Google consent URL for the browser to navigate to. */
  @Get('connect')
  connect(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.oauth.startConnect(user, requestMeta(req))
  }

  /**
   * Google redirects the browser here with no Authorization header — identity
   * is recovered solely from the single-use `state` token (see service).
   */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { redirectUrl } = await this.oauth.handleCallback({
      ...(code !== undefined ? { code } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(error !== undefined ? { error } : {}),
    })
    res.redirect(HttpStatus.FOUND, redirectUrl)
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  disconnect(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.oauth.disconnect(user, requestMeta(req))
  }

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.oauth.getStatus(user)
  }

  /** OWNER/MANAGER oversight — never exposes secrets. */
  @Get('connections')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  connections(@CurrentUser() user: AuthenticatedUser) {
    return this.oauth.listConnections(user)
  }
}
