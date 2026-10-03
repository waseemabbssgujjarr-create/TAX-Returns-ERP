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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ListDocumentsQuerySchema,
  UpdateDocumentBodySchema,
  UploadDocumentBodySchema,
  type ListDocumentsQuery,
  type UpdateDocumentBody,
  type UploadDocumentBody,
} from '@taxdesk/schemas'
import type { Request } from 'express'
import { memoryStorage } from 'multer'

import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import type { AuthenticatedUser } from '../auth/auth.types'
import { requestMeta } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { DocumentsService } from './documents.service'
import { MAX_DOCUMENT_BYTES } from './file-magic.util'

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListDocumentsQuerySchema)) query: ListDocumentsQuery,
  ) {
    return this.documents.list(user, query)
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_DOCUMENT_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(UploadDocumentBodySchema)) body: UploadDocumentBody,
    @Req() req: Request,
  ) {
    return this.documents.upload(user, file, body, requestMeta(req))
  }

  @Get(':id/versions')
  listVersions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.listVersions(user, id)
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_DOCUMENT_BYTES },
    }),
  )
  uploadVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    return this.documents.uploadVersion(user, id, file, requestMeta(req))
  }

  @Get(':id/download-url')
  downloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.documents.getSignedDownloadUrl(user, id, requestMeta(req))
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.getById(user, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDocumentBodySchema)) body: UpdateDocumentBody,
    @Req() req: Request,
  ) {
    return this.documents.update(user, id, body, requestMeta(req))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.documents.remove(user, id, requestMeta(req))
  }
}
