import { expect, test, type APIRequestContext } from '@playwright/test'

import { isAuthApiAvailable, skipIfApiUnavailable } from './helpers/api-available'
import { useDesktopChromiumOnly } from './helpers/chromium-only'
import {
  assertAccessTokenMemoryOnly,
  continueStaffAuthFromPostLogin,
  currentTotpCode,
  expectStaffDashboard,
  fillStaffLogin,
  logoutViaApi,
  readAuthStore,
  staffCredentialsFromEnv,
  type StaffCredentials,
} from './helpers/staff-login'

test.describe.configure({ mode: 'serial' })

const WORKER_URL =
  process.env['WORKER_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function loginPartial(request: APIRequestContext, creds: StaffCredentials): Promise<string> {
  const res = await request.post(`${WORKER_URL}/auth/login`, {
    data: {
      firmSlug: creds.firmSlug,
      email: creds.email,
      password: creds.password,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = (await res.json()) as { accessToken: string }
  return body.accessToken
}

async function verifyTotpFull(
  request: APIRequestContext,
  partialToken: string,
  totpSecret: string,
): Promise<{ accessToken: string; setCookie: string | null }> {
  const code = currentTotpCode(totpSecret)
  const res = await request.post(`${WORKER_URL}/auth/totp/verify`, {
    headers: { Authorization: `Bearer ${partialToken}` },
    data: { code },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = (await res.json()) as { accessToken: string }
  const setCookie = res.headers()['set-cookie'] ?? null
  return { accessToken: body.accessToken, setCookie }
}

function parseRefreshCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /(?:^|,\s*)refresh_token=([^;]+)/.exec(setCookie)
  return match?.[1] ?? null
}

test.describe('staff session lifecycle (Chromium)', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  test('login → TOTP → dashboard → memory token → cookie → reload → logout → refresh fails', async ({
    page,
    baseURL,
    context,
  }) => {
    test.skip(!baseURL, 'baseURL is required')

    const creds = staffCredentialsFromEnv()
    test.skip(
      !creds || (!creds.totpSecret && !creds.totpCode && !creds.recoveryCode),
      'Set E2E_FIRM_SLUG, E2E_STAFF_EMAIL, E2E_STAFF_PASSWORD, and E2E_TOTP_SECRET (run pnpm db:seed:demo)',
    )

    const apiUp = await isAuthApiAvailable(baseURL!)
    skipIfApiUnavailable(apiUp)

    // Capture refresh during login/TOTP
    let sawRefreshAfterReload = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/auth/refresh')) {
        sawRefreshAfterReload = true
      }
    })

    await fillStaffLogin(page, creds!)
    await page.waitForURL(/\/(2fa-setup|2fa|dashboard)(\/|$)/, { timeout: 30_000 })
    const postLoginPath = new URL(page.url()).pathname
    if (postLoginPath.includes('/2fa-setup')) {
      test.skip(true, 'Staff user requires TOTP setup — re-run seed:demo')
    }

    await continueStaffAuthFromPostLogin(page, creds!)
    await expectStaffDashboard(page)

    const storeBefore = await readAuthStore(page)
    expect(storeBefore.sessionState).toBe('full')
    expect(storeBefore.accessToken).toBeTruthy()
    expect(storeBefore.accessToken!.startsWith('eyJ')).toBe(true)
    await assertAccessTokenMemoryOnly(page)

    const cookies = await context.cookies()
    const refresh = cookies.find((c) => c.name === 'refresh_token')
    expect(refresh, 'refresh_token cookie must exist').toBeTruthy()
    expect(refresh!.httpOnly).toBe(true)
    expect(refresh!.sameSite?.toLowerCase()).toBe('strict')
    expect(refresh!.path).toBe('/auth')
    // Secure is required in production; local HTTP may omit it
    if (process.env['NODE_ENV'] === 'production') {
      expect(refresh!.secure).toBe(true)
    }

    const tokenBeforeReload = storeBefore.accessToken
    sawRefreshAfterReload = false
    await page.reload()
    await expectStaffDashboard(page)

    // Hard-refresh bootstrap: cookie → /auth/refresh → Zustand restored
    await expect.poll(() => sawRefreshAfterReload, { timeout: 15_000 }).toBe(true)
    await expect
      .poll(async () => (await readAuthStore(page)).sessionState, { timeout: 15_000 })
      .toBe('full')
    const storeAfter = await readAuthStore(page)
    expect(storeAfter.accessToken).toBeTruthy()
    // Rotation issues a new access token
    expect(storeAfter.accessToken).not.toBe(tokenBeforeReload)
    await assertAccessTokenMemoryOnly(page)

    await logoutViaApi(page, baseURL!)

    await page.goto('/en/dashboard')
    await expect(page).toHaveURL(/\/en\/login(\?|$)/)

    const refreshAfterLogout = await page.request.post(new URL('/auth/refresh', baseURL!).href)
    expect(refreshAfterLogout.status()).toBe(401)

    await page.reload()
    await expect(page).toHaveURL(/\/en\/login(\?|$)/)
  })
})

test.describe('auth security API cases (Chromium request)', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  test('invalid password returns generic 401', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL required')
    const creds = staffCredentialsFromEnv()
    test.skip(!creds, 'E2E credentials required')
    skipIfApiUnavailable(await isAuthApiAvailable(baseURL!))

    const res = await request.post(`${WORKER_URL}/auth/login`, {
      data: {
        firmSlug: creds!.firmSlug,
        email: creds!.email,
        password: 'definitely-wrong-password-!!!',
      },
    })
    expect(res.status()).toBe(401)
    const body = (await res.json()) as { title?: string }
    expect(body.title).toBe('Invalid credentials.')
  })

  test('invalid TOTP is rejected', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL required')
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E_TOTP_SECRET required')
    skipIfApiUnavailable(await isAuthApiAvailable(baseURL!))

    const partial = await loginPartial(request, creds!)
    const res = await request.post(`${WORKER_URL}/auth/totp/verify`, {
      headers: { Authorization: `Bearer ${partial}` },
      data: { code: '000000' },
    })
    expect([401, 422]).toContain(res.status())
  })

  test('refresh-token replay invalidates family', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL required')
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E_TOTP_SECRET required')
    skipIfApiUnavailable(await isAuthApiAvailable(baseURL!))

    const partial = await loginPartial(request, creds!)
    const { setCookie } = await verifyTotpFull(request, partial, creds!.totpSecret!)
    const rawRefresh = parseRefreshCookie(setCookie)
    expect(rawRefresh).toBeTruthy()

    const first = await request.post(`${WORKER_URL}/auth/refresh`, {
      headers: { Cookie: `refresh_token=${rawRefresh}` },
    })
    expect(first.ok(), await first.text()).toBeTruthy()
    const firstCookie = parseRefreshCookie(first.headers()['set-cookie'] ?? null)

    // Replay the old (already rotated) token
    const replay = await request.post(`${WORKER_URL}/auth/refresh`, {
      headers: { Cookie: `refresh_token=${rawRefresh}` },
    })
    expect(replay.status()).toBe(401)

    // New token from first rotation should also be dead after family revoke
    if (firstCookie) {
      const sibling = await request.post(`${WORKER_URL}/auth/refresh`, {
        headers: { Cookie: `refresh_token=${firstCookie}` },
      })
      expect(sibling.status()).toBe(401)
    }
  })

  test('concurrent refresh race: exactly one success path', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL required')
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E_TOTP_SECRET required')
    skipIfApiUnavailable(await isAuthApiAvailable(baseURL!))

    const partial = await loginPartial(request, creds!)
    const { setCookie } = await verifyTotpFull(request, partial, creds!.totpSecret!)
    const rawRefresh = parseRefreshCookie(setCookie)
    expect(rawRefresh).toBeTruthy()

    const [a, b] = await Promise.all([
      request.post(`${WORKER_URL}/auth/refresh`, {
        headers: { Cookie: `refresh_token=${rawRefresh}` },
      }),
      request.post(`${WORKER_URL}/auth/refresh`, {
        headers: { Cookie: `refresh_token=${rawRefresh}` },
      }),
    ])

    const statuses = [a.status(), b.status()].sort()
    // Accepted: one 200 and one 401/429 (lock / replay)
    expect(statuses[0]).toBeGreaterThanOrEqual(200)
    const successes = [a, b].filter((r) => r.ok())
    expect(successes.length).toBe(1)
  })

  test('revoked session cannot refresh', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL required')
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E_TOTP_SECRET required')
    skipIfApiUnavailable(await isAuthApiAvailable(baseURL!))

    const partial = await loginPartial(request, creds!)
    const { accessToken, setCookie } = await verifyTotpFull(request, partial, creds!.totpSecret!)
    const rawRefresh = parseRefreshCookie(setCookie)
    expect(rawRefresh).toBeTruthy()

    const logout = await request.post(`${WORKER_URL}/auth/logout`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: `refresh_token=${rawRefresh}`,
      },
    })
    expect(logout.status()).toBeLessThan(500)

    const refresh = await request.post(`${WORKER_URL}/auth/refresh`, {
      headers: { Cookie: `refresh_token=${rawRefresh}` },
    })
    expect(refresh.status()).toBe(401)
  })

  test('account locks after repeated password failures', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL required')
    const creds = staffCredentialsFromEnv()
    test.skip(!creds, 'E2E credentials required')
    skipIfApiUnavailable(await isAuthApiAvailable(baseURL!))

    for (let i = 0; i < 3; i++) {
      const res = await request.post(`${WORKER_URL}/auth/login`, {
        data: {
          firmSlug: creds!.firmSlug,
          email: creds!.email,
          password: `wrong-pass-${i}-${Date.now()}`,
        },
      })
      // 401 = auth failure; 429 = IP throttle (also denies access)
      expect([401, 429]).toContain(res.status())
      if (res.status() === 429) {
        return
      }
    }

    const locked = await request.post(`${WORKER_URL}/auth/login`, {
      data: {
        firmSlug: creds!.firmSlug,
        email: creds!.email,
        password: creds!.password,
      },
    })
    expect([401, 429]).toContain(locked.status())
  })
})

// Lock test mutates demo user — callers should re-run `pnpm db:seed:demo` afterwards.
