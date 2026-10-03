import type { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

/** OpenAI structured-output compatible JSON schema from a Zod schema */
export function zodSchemaToOpenAiJsonSchema(
  schema: z.ZodType,
  name: string,
): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, {
    name,
    $refStrategy: 'none',
  }) as Record<string, unknown>

  delete jsonSchema.$schema
  return jsonSchema
}
