import { expect, test, type APIRequestContext } from '@playwright/test'

import { isAuthApiAvailable, skipIfApiUnavailable } from './helpers/api-available'
import { useDesktopChromiumOnly } from './helpers/chromium-only'
import {
  currentTotpCode,
  staffCredentialsFromEnv,
  type StaffCredentials,
} from './helpers/staff-login'

const WORKER_URL =
  process.env['WORKER_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const DEMO_CLIENT_ID = '33333333-3333-4333-8333-333333333333'
const TAX_YEAR = new Date().getFullYear()

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

test.describe('document hub API (Chromium request)', () => {
  test.beforeEach(async ({ baseURL }) => {
    useDesktopChromiumOnly()
    test.skip(!baseURL, 'baseURL is required')
    const apiUp = await isAuthApiAvailable(baseURL!)
    skipIfApiUnavailable(apiUp)
  })

  test('upload → list → detail → categorize → download-url → version', async ({ request }) => {
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E credentials missing')
    if (!creds?.totpSecret) return

    const token = await staffAccessToken(request, creds)
    const pdf = Buffer.from('%PDF-1.4\n%e2e-document-hub\n')

    const upload = await request.post(`${WORKER_URL}/documents/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'e2e-doc.pdf',
          mimeType: 'application/pdf',
          buffer: pdf,
        },
        clientId: DEMO_CLIENT_ID,
        taxYear: String(TAX_YEAR),
      },
    })
    expect(upload.status(), await upload.text()).toBe(201)
    const uploaded = (await upload.json()) as { id: string; version: number }
    expect(uploaded.version).toBe(1)

    const list = await request.get(
      `${WORKER_URL}/documents?clientId=${DEMO_CLIENT_ID}&taxYear=${TAX_YEAR}&page=1&pageSize=20`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(list.ok(), await list.text()).toBeTruthy()
    const listBody = (await list.json()) as { items: Array<{ id: string }> }
    expect(listBody.items.some((i) => i.id === uploaded.id)).toBeTruthy()

    const patch = await request.patch(`${WORKER_URL}/documents/${uploaded.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: { category: 'BANK_STATEMENT', reviewStatus: 'IN_REVIEW' },
    })
    expect(patch.ok(), await patch.text()).toBeTruthy()
    const patched = (await patch.json()) as { category: string; reviewStatus: string }
    expect(patched.category).toBe('BANK_STATEMENT')
    expect(patched.reviewStatus).toBe('IN_REVIEW')

    const detail = await request.get(`${WORKER_URL}/documents/${uploaded.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(detail.ok(), await detail.text()).toBeTruthy()
    const detailBody = (await detail.json()) as {
      id: string
      taxYear: number | null
    }
    expect(detailBody.id).toBe(uploaded.id)
    expect(detailBody.taxYear).toBe(TAX_YEAR)

    const download = await request.get(`${WORKER_URL}/documents/${uploaded.id}/download-url`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(download.ok(), await download.text()).toBeTruthy()
    const downloadBody = (await download.json()) as { url: string; expiresInSeconds: number }
    expect(downloadBody.url).toMatch(/^https?:\/\//)
    expect(downloadBody.expiresInSeconds).toBeGreaterThan(0)

    const version = await request.post(`${WORKER_URL}/documents/${uploaded.id}/versions`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'e2e-doc-v2.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\n%e2e-v2\n'),
        },
      },
    })
    expect(version.status(), await version.text()).toBe(201)
    const versionBody = (await version.json()) as {
      id: string
      version: number
      previousVersionId: string | null
    }
    expect(versionBody.version).toBe(2)
    expect(versionBody.previousVersionId).toBe(uploaded.id)

    const versions = await request.get(`${WORKER_URL}/documents/${versionBody.id}/versions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(versions.ok(), await versions.text()).toBeTruthy()
    const versionsBody = (await versions.json()) as { items: Array<{ id: string }> }
    expect(versionsBody.items.length).toBeGreaterThanOrEqual(2)

    const del = await request.delete(`${WORKER_URL}/documents/${versionBody.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(del.status()).toBe(204)
  })
})
