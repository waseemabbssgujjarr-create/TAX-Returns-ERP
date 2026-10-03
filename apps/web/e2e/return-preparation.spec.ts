import { expect, test, type APIRequestContext } from '@playwright/test'

import { isAuthApiAvailable, skipIfApiUnavailable } from './helpers/api-available'
import { runAxeIfAvailable } from './helpers/axe'
import { useDesktopChromiumOnly } from './helpers/chromium-only'
import {
  completeStaffAuthToDashboard,
  currentTotpCode,
  staffCredentialsFromEnv,
  type StaffCredentials,
} from './helpers/staff-login'

const WORKER_URL =
  process.env['WORKER_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const DEMO_CLIENT_ID = '33333333-3333-4333-8333-333333333333'

async function staffAccessToken(
  request: APIRequestContext,
  creds: StaffCredentials,
): Promise<string> {
  const login = await request.post(`${WORKER_URL}/auth/login`, {
    data: {
      firmSlug: creds.firmSlug,
      email: creds.email,
      password: creds.password,
    },
  })
  expect(login.ok(), await login.text()).toBeTruthy()
  const loginBody = (await login.json()) as { accessToken: string }

  const totp = await request.post(`${WORKER_URL}/auth/totp/verify`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    data: { code: currentTotpCode(creds.totpSecret!) },
  })
  expect(totp.ok(), await totp.text()).toBeTruthy()
  const totpBody = (await totp.json()) as { accessToken: string }
  return totpBody.accessToken
}

async function resolveTaxYearFileId(request: APIRequestContext, token: string): Promise<string> {
  const list = await request.get(`${WORKER_URL}/clients/${DEMO_CLIENT_ID}/tax-years`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(list.ok(), await list.text()).toBeTruthy()
  const listBody = (await list.json()) as { items?: Array<{ id: string }> } | Array<{ id: string }>
  const existing = Array.isArray(listBody) ? listBody[0]?.id : listBody.items?.[0]?.id
  if (existing) return existing

  const created = await request.post(`${WORKER_URL}/clients/${DEMO_CLIENT_ID}/tax-years`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { taxYear: new Date().getFullYear() },
  })
  if (created.ok()) {
    return ((await created.json()) as { id: string }).id
  }
  const again = await request.get(`${WORKER_URL}/clients/${DEMO_CLIENT_ID}/tax-years`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const againBody = (await again.json()) as
    | { items?: Array<{ id: string }> }
    | Array<{ id: string }>
  const id = Array.isArray(againBody) ? againBody[0]?.id : againBody.items?.[0]?.id
  expect(id).toBeTruthy()
  return id!
}

test.describe('return preparation workspace', () => {
  test.beforeEach(async ({ baseURL }) => {
    useDesktopChromiumOnly()
    test.skip(!baseURL, 'baseURL is required')
    const apiUp = await isAuthApiAvailable(baseURL!)
    skipIfApiUnavailable(apiUp)
  })

  test('API: assemble → notes → activity (not filing)', async ({ request }) => {
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E credentials missing')
    if (!creds?.totpSecret) return

    const token = await staffAccessToken(request, creds)
    const taxYearFileId = await resolveTaxYearFileId(request, token)

    const assemble = await request.post(
      `${WORKER_URL}/tax-years/${taxYearFileId}/return-prep/assemble`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(assemble.ok(), await assemble.text()).toBeTruthy()
    const assembled = (await assemble.json()) as {
      reviewStatus: string
      structuredJson: {
        filingDisclaimer?: string
        validation?: { status: string; canApprove: boolean }
        fields?: unknown[]
        missing?: unknown[]
      }
    }
    expect(assembled.structuredJson.filingDisclaimer).toBe('NOT_IRIS_FBR_SUBMISSION')
    expect(assembled.structuredJson.validation).toBeTruthy()
    expect(Array.isArray(assembled.structuredJson.fields)).toBeTruthy()
    expect(Array.isArray(assembled.structuredJson.missing)).toBeTruthy()
    // Draft/placeholder rules keep approval fail-closed
    expect(assembled.structuredJson.validation?.canApprove).toBe(false)

    const notes = await request.put(`${WORKER_URL}/tax-years/${taxYearFileId}/return-prep`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { notes: 'E2E reviewer note - not a filing.' },
    })
    expect(notes.ok(), await notes.text()).toBeTruthy()

    if (assembled.reviewStatus === 'DRAFT') {
      const submit = await request.post(
        `${WORKER_URL}/tax-years/${taxYearFileId}/return-prep/submit-review`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      expect([200, 400].includes(submit.status()), await submit.text()).toBeTruthy()
    }

    const activity = await request.get(
      `${WORKER_URL}/tax-years/${taxYearFileId}/return-prep/activity`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(activity.ok(), await activity.text()).toBeTruthy()
    const acts = (await activity.json()) as unknown[]
    expect(acts.length).toBeGreaterThan(0)
  })

  test('UI EN: return prep panel accessible with axe clean', async ({ page, request, baseURL }) => {
    test.setTimeout(120_000)
    test.skip(!baseURL, 'baseURL required')
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E credentials missing')
    if (!creds?.totpSecret) return

    const token = await staffAccessToken(request, creds)
    const taxYearFileId = await resolveTaxYearFileId(request, token)

    await completeStaffAuthToDashboard(page, creds)
    await page.goto(`/en/tax-years/${taxYearFileId}`, { waitUntil: 'domcontentloaded' })
    const heading = page.getByRole('heading', { name: /return preparation/i })
    try {
      await expect(heading).toBeVisible({ timeout: 60_000 })
    } catch {
      // One retry after auth hydrate / Fast Refresh
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(heading).toBeVisible({ timeout: 60_000 })
    }
    await page
      .getByRole('button', { name: /assemble from workspace|assemble/i })
      .first()
      .click()
    await expect(page.getByText(/not automated FBR\/IRIS/i).first()).toBeVisible({
      timeout: 30_000,
    })
    await runAxeIfAvailable(page, { include: '[aria-labelledby="return-prep-heading"]' })
  })
})
