import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'

import { AppModule } from './app.module'
import { ProblemDetailsFilter } from './common/problem-details.filter'
import { validateEnv } from './config/env.validation'

async function bootstrap() {
  // Validate environment variables at startup — fail fast before the app starts
  validateEnv()

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  })

  app.use(cookieParser())
  app.useGlobalFilters(new ProblemDetailsFilter())

  const port = process.env['WORKER_PORT'] ?? 3001
  await app.listen(port)

  Logger.log(`Worker running on port ${port}`, 'Bootstrap')
}

void bootstrap()
