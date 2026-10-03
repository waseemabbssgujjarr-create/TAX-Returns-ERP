/** API base URL — browser uses same-origin /auth rewrite; SSR may call worker directly. */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return ''
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) {
    return undefined as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError('Invalid response from server', res.status)
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { parseJson?: boolean },
): Promise<T> {
  const base = getApiBaseUrl()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await parseJsonResponse<unknown>(res).catch(() => undefined)
    throw new ApiError(res.statusText || 'Request failed', res.status, body)
  }

  if (init?.parseJson === false || res.status === 204) {
    return undefined as T
  }

  return parseJsonResponse<T>(res)
}
