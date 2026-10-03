import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import type { ZodType } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema: ZodType<unknown>) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        type: 'https://taxdesk.pk/problems/validation-error',
        title: 'Validation failed',
        status: 400,
        errors: result.error.flatten().fieldErrors,
      })
    }
    return result.data
  }
}
