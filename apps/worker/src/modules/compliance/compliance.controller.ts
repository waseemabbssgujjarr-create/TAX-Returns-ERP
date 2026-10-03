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
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import {
  CreateComplianceEventBodySchema,
  CreateNoticeBodySchema,
  ListComplianceEventsQuerySchema,
  ListNoticesQuerySchema,
  PenaltyEstimateBodySchema,
  UpdateNoticeBodySchema,
  type CreateComplianceEventBody,
  type CreateNoticeBody,
  type ListComplianceEventsQuery,
  type ListNoticesQuery,
  type PenaltyEstimateBody,
  type UpdateNoticeBody,
} from '@taxdesk/schemas'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { ComplianceService } from './compliance.service'

@Controller()
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('notices')
  listNotices(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListNoticesQuerySchema)) query: ListNoticesQuery,
  ) {
    return this.compliance.listNotices(user, query)
  }

  @Post('notices')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  createNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateNoticeBodySchema)) body: CreateNoticeBody,
  ) {
    return this.compliance.createNotice(user, body)
  }

  @Patch('notices/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  updateNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateNoticeBodySchema)) body: UpdateNoticeBody,
  ) {
    return this.compliance.updateNotice(user, id, body)
  }

  @Get('compliance-events')
  listEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListComplianceEventsQuerySchema)) query: ListComplianceEventsQuery,
  ) {
    return this.compliance.listComplianceEvents(user, query)
  }

  @Post('compliance-events')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  createEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateComplianceEventBodySchema)) body: CreateComplianceEventBody,
  ) {
    return this.compliance.createComplianceEvent(user, body)
  }

  @Post('compliance/penalty-estimate')
  @HttpCode(HttpStatus.OK)
  estimatePenalty(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(PenaltyEstimateBodySchema)) body: PenaltyEstimateBody,
  ) {
    return this.compliance.estimatePenalty(user, body)
  }
}
