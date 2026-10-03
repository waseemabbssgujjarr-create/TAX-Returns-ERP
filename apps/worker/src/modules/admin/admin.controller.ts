import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import {
  ListAuditLogsQuerySchema,
  PatchFirmSettingsBodySchema,
  PatchUserRoleBodySchema,
  RevokeSessionBodySchema,
  type ListAuditLogsQuery,
  type PatchFirmSettingsBody,
  type PatchUserRoleBody,
  type RevokeSessionBody,
} from '@taxdesk/schemas'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  listUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listUsers(user)
  }

  @Patch('users/:userId/role')
  @Roles(UserRole.OWNER)
  @UsePipes(new ZodValidationPipe(PatchUserRoleBodySchema))
  patchRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: PatchUserRoleBody,
  ) {
    return this.admin.patchUserRole(user, userId, body)
  }

  @Get('sessions')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listSessions(user)
  }

  @Post('sessions/:sessionId/revoke')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER)
  @UsePipes(new ZodValidationPipe(RevokeSessionBodySchema))
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: RevokeSessionBody,
  ) {
    return this.admin.revokeSession(user, sessionId, body.reason)
  }

  @Get('audit-logs')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  auditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListAuditLogsQuerySchema)) query: ListAuditLogsQuery,
  ) {
    return this.admin.listAuditLogs(user, query)
  }

  @Get('firm-settings')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  firmSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getFirmSettings(user)
  }

  @Patch('firm-settings')
  @Roles(UserRole.OWNER)
  @UsePipes(new ZodValidationPipe(PatchFirmSettingsBodySchema))
  patchFirmSettings(@CurrentUser() user: AuthenticatedUser, @Body() body: PatchFirmSettingsBody) {
    return this.admin.patchFirmSettings(user, body)
  }
}
