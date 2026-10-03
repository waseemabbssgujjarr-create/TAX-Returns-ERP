import { Controller, Get } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

import { PortalService } from './portal.service'

@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('home')
  @Roles(UserRole.CLIENT)
  getHome(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.getHome(user)
  }
}
