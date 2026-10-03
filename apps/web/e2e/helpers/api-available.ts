import { test } from '@playwright/test'

/**
 * Returns true when the auth API is reachable through the Next.js /auth rewrite.
 * A 401 on refresh without a cookie still means the worker is up.
 */
export async function isAuthApiAvailable(baseURL: string): Promise<boolean> {
  const url = new URL('/auth/refresh', baseURL).href
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    return res.status > 0 && res.status < 500
  } catch {
    return false
  }
}

export function skipIfApiUnavailable(
  available: boolean,
  reason = 'Auth API unavailable (start worker + db)',
): void {
  if (!available) {
    test.skip(true, reason)
  }
}
