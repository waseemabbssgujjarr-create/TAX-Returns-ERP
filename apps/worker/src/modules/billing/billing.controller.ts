import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import {
  CreateInvoiceBodySchema,
  ListInvoicesQuerySchema,
  RecordPaymentBodySchema,
  type CreateInvoiceBody,
  type ListInvoicesQuery,
  type RecordPaymentBody,
} from '@taxdesk/schemas'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { BillingService } from './billing.service'

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('invoices')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListInvoicesQuerySchema)) query: ListInvoicesQuery,
  ) {
    return this.billing.listInvoices(user, query)
  }

  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @UsePipes(new ZodValidationPipe(CreateInvoiceBodySchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateInvoiceBody) {
    return this.billing.createInvoice(user, body)
  }

  @Post('invoices/:id/payments')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @UsePipes(new ZodValidationPipe(RecordPaymentBodySchema))
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
    @Body() body: RecordPaymentBody,
  ) {
    return this.billing.recordPayment(user, invoiceId, body)
  }
}
