import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { authenticator } from 'otplib'

export interface StaffCredentials {
  firmSlug: string
  email: string
  password: string
  totpCode?: string
  totpSecret?: string
  recoveryCode?: string
}

export function staffCredentialsFromEnv(): StaffCredentials | null {
  const firmSlug = process.env['E2E_FIRM_SLUG']
  const email = process.env['E2E_STAFF_EMAIL']
  const password = process.env['E2E_STAFF_PASSWORD']
  if (!firmSlug || !email || !password) return null
  const creds: StaffCredentials = { firmSlug, email, password }
  const totpCode = process.env['E2E_TOTP_CODE']
  const totpSecret = process.env['E2E_TOTP_SECRET']
  const recoveryCode = process.env['E2E_RECOVERY_CODE']
  if (totpCode) creds.totpCode = totpCode
  if (totpSecret) creds.totpSecret = totpSecret
  if (recoveryCode) creds.recoveryCode = recoveryCode
  return creds
}

/** Live TOTP code — never log the secret. */
export function currentTotpCode(secret: string): string {
  return authenticator.generate(secret)
}

export async function resolveTotpCode(creds: StaffCredentials): Promise<string | undefined> {
  if (creds.totpCode) return creds.totpCode
  if (creds.totpSecret) return currentTotpCode(creds.totpSecret)
  return undefined
}

export async function fillStaffLogin(page: Page, creds: StaffCredentials): Promise<void> {
  await page.goto('/en/login')
  await page.locator('#firmSlug').click()
  await page.locator('#firmSlug').fill(creds.firmSlug)
  await page.locator('#email').click()
  await page.locator('#email').fill(creds.email)
  await page.locator('#password').click()
  await page.locator('#password').fill(creds.password)
  await page.locator('#firmSlug').evaluate((el) => {
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  })

  const loginResponse = page.waitForResponse(
    (res) => res.url().includes('/auth/login') && res.request().method() === 'POST',
    { timeout: 45_000 },
  )
  await page.getByRole('button', { name: 'Sign in' }).click()
  const res = await loginResponse
  if (!res.ok()) {
    throw new Error(`Login API failed: ${res.status()} ${await res.text()}`)
  }
}

/** Continues from post-login URL (/2fa, /2fa-setup, or /dashboard). */
export async function continueStaffAuthFromPostLogin(
  page: Page,
  creds: StaffCredentials,
): Promise<void> {
  const path = new URL(page.url()).pathname

  if (path.includes('/dashboard')) {
    return
  }

  if (path.includes('/2fa-setup')) {
    throw new Error(
      'Account requires TOTP setup — seed a staff user with TOTP already enabled (pnpm db:seed:demo)',
    )
  }

  if (path.includes('/2fa')) {
    const code = await resolveTotpCode(creds)
    if (code) {
      const totp = page.locator('#totp-code')
      await totp.click()
      // Controlled React input: fill() reliably syncs value+onChange; pressSequentially can desync.
      await totp.fill(code)
      await expect(totp).toHaveValue(code)
      const verifyResponse = page.waitForResponse(
        (res) => res.url().includes('/auth/totp/verify') && res.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Verify' }).click()
      const res = await verifyResponse
      if (!res.ok()) {
        throw new Error(`TOTP verify failed: ${res.status()} ${await res.text()}`)
      }
    } else if (creds.recoveryCode) {
      await page.goto('/en/recover')
      await page.locator('#recovery-code').fill(creds.recoveryCode)
      await page.getByRole('button', { name: 'Verify' }).click()
    } else {
      throw new Error(
        '2FA required — set E2E_TOTP_SECRET (preferred) or E2E_TOTP_CODE / E2E_RECOVERY_CODE',
      )
    }

    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 30_000 })
    return
  }

  throw new Error(`Unexpected post-login URL: ${page.url()}`)
}

/** Login → 2FA if needed → dashboard. */
export async function completeStaffAuthToDashboard(
  page: Page,
  creds: StaffCredentials,
): Promise<void> {
  await fillStaffLogin(page, creds)
  await page.waitForURL(/\/(2fa-setup|2fa|dashboard)(\/|$)/, { timeout: 30_000 })
  await continueStaffAuthFromPostLogin(page, creds)
}

export async function expectStaffDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/en\/dashboard(\/|$)/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export async function logoutViaApi(page: Page, baseURL: string): Promise<void> {
  const res = await page.request.post(new URL('/auth/logout', baseURL).href)
  expect(res.status()).toBe(200)
  await page.context().clearCookies()
  await page.evaluate(() => {
    const store = (
      window as unknown as {
        __TAXDESK_AUTH_STORE__?: {
          setState: (partial: { accessToken: null; sessionState: string }) => void
        }
      }
    ).__TAXDESK_AUTH_STORE__
    store?.setState({ accessToken: null, sessionState: 'anonymous' })
  })
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies()
      return cookies.filter((c) => c.name === 'refresh_token' || c.name === 'td_session').length
    })
    .toBe(0)
}

export async function readAuthStore(page: Page): Promise<{
  accessToken: string | null
  sessionState: string
}> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __TAXDESK_AUTH_STORE__?: {
          getState: () => { accessToken: string | null; sessionState: string }
        }
      }
    ).__TAXDESK_AUTH_STORE__
    if (!store) {
      throw new Error('__TAXDESK_AUTH_STORE__ not exposed — AuthSessionProvider missing?')
    }
    const s = store.getState()
    return { accessToken: s.accessToken, sessionState: s.sessionState }
  })
}

export async function assertAccessTokenMemoryOnly(page: Page): Promise<void> {
  const leaks = await page.evaluate(() => {
    const suspicious: string[] = []
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i)
        if (!key) continue
        const val = store.getItem(key) ?? ''
        if (/access|token|jwt|bearer/i.test(key) || /^eyJ/.test(val)) {
          suspicious.push(key)
        }
      }
    }
    return suspicious
  })
  expect(leaks, `access token must not be in browser storage: ${leaks.join(',')}`).toEqual([])
}
