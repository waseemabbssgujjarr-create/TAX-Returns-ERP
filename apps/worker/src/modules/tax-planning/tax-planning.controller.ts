import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UsePipes } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { CreateTaxPlanScenarioBodySchema, type CreateTaxPlanScenarioBody } from '@taxdesk/schemas'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { TaxPlanningService } from './tax-planning.service'

@Controller()
export class TaxPlanningController {
  constructor(private readonly taxPlanning: TaxPlanningService) {}

  @Get('tax-years/:id/tax-plans')
  list(@CurrentUser() user: AuthenticatedUser, @Param('id') taxYearFileId: string) {
    return this.taxPlanning.list(user, taxYearFileId)
  }

  @Post('tax-years/:id/tax-plans')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  @UsePipes(new ZodValidationPipe(CreateTaxPlanScenarioBodySchema))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') taxYearFileId: string,
    @Body() body: CreateTaxPlanScenarioBody,
  ) {
    return this.taxPlanning.create(user, taxYearFileId, body)
  }
}
