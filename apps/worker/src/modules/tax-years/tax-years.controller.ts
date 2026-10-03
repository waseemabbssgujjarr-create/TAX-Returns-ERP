import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import {
  CreateTaxYearBodySchema,
  CreateWithholdingEntryBodySchema,
  ListTaxYearsQuerySchema,
  UpdateTaxYearBodySchema,
  UpdateWithholdingEntryBodySchema,
  UpsertReturnPreparationBodySchema,
  ApproveReturnPrepBodySchema,
  DemoteReturnPrepBodySchema,
  UpsertWealthStatementBodySchema,
  SubmitIrisFilingBodySchema,
  RecordManualIrisReferenceBodySchema,
  type CreateTaxYearBody,
  type CreateWithholdingEntryBody,
  type ListTaxYearsQuery,
  type UpdateTaxYearBody,
  type UpdateWithholdingEntryBody,
  type UpsertReturnPreparationBody,
  type ApproveReturnPrepBody,
  type DemoteReturnPrepBody,
  type UpsertWealthStatementBody,
  type SubmitIrisFilingBody,
  type RecordManualIrisReferenceBody,
} from '@taxdesk/schemas'
import type { Request } from 'express'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import type { AuthenticatedUser } from '../auth/auth.types'
import { requestMeta } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { ComputationService } from './computation.service'
import { IrisFilingService } from './iris-filing.service'
import { ReturnPreparationService } from './return-preparation.service'
import { TaxYearsService } from './tax-years.service'
import { WealthStatementService } from './wealth-statement.service'
import { WithholdingService } from './withholding.service'

@Controller()
export class TaxYearsController {
  constructor(
    private readonly taxYears: TaxYearsService,
    private readonly computation: ComputationService,
    private readonly wealth: WealthStatementService,
    private readonly withholding: WithholdingService,
    private readonly returnPrep: ReturnPreparationService,
    private readonly filing: IrisFilingService,
  ) {}

  // ── Firm-wide "Returns" list — practice-level view across all clients (F4) ─────

  @Get('tax-years')
  listForFirm(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListTaxYearsQuerySchema)) query: ListTaxYearsQuery,
  ) {
    return this.taxYears.listForFirm(user, query)
  }

  @Get('clients/:clientId/tax-years')
  listForClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Query(new ZodValidationPipe(ListTaxYearsQuerySchema)) query: ListTaxYearsQuery,
  ) {
    return this.taxYears.listByClient(user, clientId, query)
  }

  @Post('clients/:clientId/tax-years')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  @UsePipes(new ZodValidationPipe(CreateTaxYearBodySchema))
  createForClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Body() body: CreateTaxYearBody,
  ) {
    return this.taxYears.createForClient(user, clientId, body)
  }

  @Get('tax-years/:id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.taxYears.getById(user, id)
  }

  @Patch('tax-years/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  @UsePipes(new ZodValidationPipe(UpdateTaxYearBodySchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateTaxYearBody,
  ) {
    return this.taxYears.update(user, id, body)
  }

  @Post('tax-years/:id/compute')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  compute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.computation.computeForTaxYearFile(user, id)
  }

  @Get('tax-years/:id/wealth')
  getWealth(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wealth.get(user, id)
  }

  @Put('tax-years/:id/wealth')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  @UsePipes(new ZodValidationPipe(UpsertWealthStatementBodySchema))
  upsertWealth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpsertWealthStatementBody,
    @Req() req: Request,
  ) {
    return this.wealth.upsert(user, id, body, requestMeta(req))
  }

  @Get('tax-years/:id/withholding')
  listWithholding(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.withholding.list(user, id)
  }

  @Post('tax-years/:id/withholding')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  @UsePipes(new ZodValidationPipe(CreateWithholdingEntryBodySchema))
  createWithholding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateWithholdingEntryBody,
  ) {
    return this.withholding.create(user, id, body)
  }

  @Patch('withholding/:entryId')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  @UsePipes(new ZodValidationPipe(UpdateWithholdingEntryBodySchema))
  updateWithholding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId') entryId: string,
    @Body() body: UpdateWithholdingEntryBody,
  ) {
    return this.withholding.update(user, entryId, body)
  }

  @Post('tax-years/:id/withholding/reconcile')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  reconcileWithholding(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.withholding.reconcile(user, id)
  }

  @Get('tax-years/:id/withholding/checklist')
  withholdingChecklist(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.withholding.checklist(user, id)
  }

  @Get('tax-years/:id/return-prep')
  getReturnPrep(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.returnPrep.get(user, id)
  }

  @Put('tax-years/:id/return-prep')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  upsertReturnPrep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpsertReturnPreparationBodySchema))
    body: UpsertReturnPreparationBody,
  ) {
    return this.returnPrep.upsert(user, id, body)
  }

  @Post('tax-years/:id/return-prep/assemble')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  assembleReturnPrep(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.returnPrep.assemble(user, id)
  }

  @Post('tax-years/:id/return-prep/submit-review')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  submitReturnPrepReview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.returnPrep.submitForReview(user, id)
  }

  @Post('tax-years/:id/return-prep/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.REVIEWER)
  approveReturnPrep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ApproveReturnPrepBodySchema)) body: ApproveReturnPrepBody,
  ) {
    return this.returnPrep.approve(user, id, body)
  }

  @Post('tax-years/:id/return-prep/demote')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  demoteReturnPrep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DemoteReturnPrepBodySchema)) body: DemoteReturnPrepBody,
  ) {
    return this.returnPrep.demote(user, id, body)
  }

  @Get('tax-years/:id/return-prep/activity')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  returnPrepActivity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.returnPrep.activity(user, id)
  }

  // ── IRIS filing (submission tracking — honest states only) ─────────────────

  @Get('tax-years/:id/filing')
  getFiling(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.filing.get(user, id)
  }

  @Post('tax-years/:id/filing/prepare')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE)
  prepareFiling(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.filing.prepare(user, id)
  }

  @Post('tax-years/:id/filing/submit')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.REVIEWER)
  submitFiling(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SubmitIrisFilingBodySchema)) body: SubmitIrisFilingBody,
  ) {
    return this.filing.submit(user, id, body)
  }

  @Post('tax-years/:id/filing/record-manual-reference')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.REVIEWER)
  recordManualIrisReference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RecordManualIrisReferenceBodySchema))
    body: RecordManualIrisReferenceBody,
  ) {
    return this.filing.recordManualReference(user, id, body)
  }

  @Post('tax-years/:id/filing/refresh-status')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  refreshFilingStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.filing.refreshStatus(user, id)
  }

  @Get('tax-years/:id/filing/activity')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ASSOCIATE, UserRole.REVIEWER)
  filingActivity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.filing.activity(user, id)
  }
}
