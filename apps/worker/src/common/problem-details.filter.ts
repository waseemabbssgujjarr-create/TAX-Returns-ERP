import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const problem =
        typeof body === 'object' && body !== null && 'type' in body
          ? body
          : {
              type: 'about:blank',
              title: exception.message,
              status,
            }

      response.status(status).type('application/problem+json').json(problem)
      return
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : exception,
    )
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).type('application/problem+json').json({
      type: 'https://taxdesk.pk/problems/internal-error',
      title: 'Internal server error',
      status: 500,
    })
  }
}
