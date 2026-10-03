import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import {
  AddClientNoteBodySchema,
  CheckDuplicateQuerySchema,
  CreateClientBodySchema,
  ListClientsQuerySchema,
  RevealClientFieldBodySchema,
  UpdateClientBodySchema,
  type AddClientNoteBody,
  type CheckDuplicateQuery,
  type CreateClientBody,
  type ListClientsQuery,
  type RevealClientFieldBody,
  type UpdateClientBody,
} from '@taxdesk/schemas'
import type { Request } from 'express'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import type { AuthenticatedUser } from '../auth/auth.types'
import { requestMeta } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { ClientsService } from './clients.service'

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListClientsQuerySchema)) query: ListClientsQuery,
  ) {
    return this.clients.list(user, query)
  }

  @Get('check-duplicate')
  checkDuplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(CheckDuplicateQuerySchema)) query: CheckDuplicateQuery,
  ) {
    return this.clients.checkDuplicate(user, query)
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clients.getById(user, id)
  }

  @Get(':id/activity')
  activity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clients.activity(user, id)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateClientBodySchema)) body: CreateClientBody,
    @Req() req: Request,
  ) {
    return this.clients.create(user, body, requestMeta(req))
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateClientBodySchema)) body: UpdateClientBody,
    @Req() req: Request,
  ) {
    return this.clients.update(user, id, body, requestMeta(req))
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    return this.clients.archive(user, id, requestMeta(req))
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.clients.remove(user, id, requestMeta(req))
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddClientNoteBodySchema)) body: AddClientNoteBody,
    @Req() req: Request,
  ) {
    return this.clients.addNote(user, id, body, requestMeta(req))
  }

  @Post(':id/reveal-field')
  @HttpCode(HttpStatus.OK)
  revealField(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RevealClientFieldBodySchema)) body: RevealClientFieldBody,
    @Req() req: Request,
  ) {
    return this.clients.revealField(user, id, body, requestMeta(req))
  }
}
