import { Body, Controller, Get, Param, Post, UsePipes } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { CreateExportBodySchema, type CreateExportBody } from '@taxdesk/schemas'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { ExportGeneratorService } from './export-generator.service'

@Controller()
export class ExportsController {
  constructor(private readonly exports: ExportGeneratorService) {}

  @Post('exports')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  @UsePipes(new ZodValidationPipe(CreateExportBodySchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateExportBody) {
    return this.exports.requestExport(user, body)
  }

  @Get('exports/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exports.getArtifact(user, id)
  }

  @Get('exports/:id/download-url')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  download(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exports.getDownloadUrl(user, id)
  }
}
