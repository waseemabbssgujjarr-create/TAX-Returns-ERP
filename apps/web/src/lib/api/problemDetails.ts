export type ProblemDetailsBody = {
  title?: string
  detail?: string
  message?: string
  errors?: Record<string, string[]>
}

export function asProblemDetails(body: unknown): ProblemDetailsBody | null {
  if (!body || typeof body !== 'object') return null
  return body as ProblemDetailsBody
}

export function getProblemFieldErrors(body: unknown): Record<string, string[]> {
  const problem = asProblemDetails(body)
  if (!problem?.errors || typeof problem.errors !== 'object') return {}
  return problem.errors
}

export function getProblemTitle(body: unknown): string | undefined {
  const problem = asProblemDetails(body)
  return problem?.title ?? problem?.message ?? problem?.detail
}
