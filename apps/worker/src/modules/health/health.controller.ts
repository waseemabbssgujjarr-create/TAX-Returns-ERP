import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

import { Public } from '../auth/decorators/public.decorator'

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // TODO: add Postgres and Redis health indicators in infrastructure spec
    ])
  }
}
