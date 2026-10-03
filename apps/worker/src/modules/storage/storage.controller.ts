import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common'
import type { Response } from 'express'

import { Public } from '../auth/decorators/public.decorator'

import { LocalFsStorageAdapter } from './local-fs-storage.adapter'
import { OBJECT_STORAGE_PROVIDER, type ObjectStorageProvider } from './object-storage.interface'

@Controller('storage')
export class StorageController {
  constructor(
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly storage: ObjectStorageProvider,
  ) {}

  /** HMAC-signed local object download (STORAGE_DRIVER=local only). */
  @Public()
  @Get('object')
  download(
    @Query('key') key: string | undefined,
    @Query('exp') expRaw: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    if (!(this.storage instanceof LocalFsStorageAdapter)) {
      throw new ForbiddenException({
        type: 'https://taxdesk.pk/problems/forbidden',
        title: 'Forbidden',
        status: 403,
      })
    }
    if (!key || !expRaw || !sig) {
      throw new ForbiddenException({
        type: 'https://taxdesk.pk/problems/forbidden',
        title: 'Forbidden',
        status: 403,
      })
    }
    const exp = Number(expRaw)
    if (!this.storage.verifySignedRequest(key, exp, sig)) {
      throw new ForbiddenException({
        type: 'https://taxdesk.pk/problems/forbidden',
        title: 'Forbidden',
        status: 403,
      })
    }

    const stream = this.storage.openReadStream(key)
    res.setHeader('Content-Disposition', `inline; filename="${key.split('/').pop() ?? 'file'}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    return new StreamableFile(stream)
  }
}
