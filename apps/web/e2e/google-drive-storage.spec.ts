import { expect, test } from '@playwright/test'

import { isAuthApiAvailable, skipIfApiUnavailable } from './helpers/api-available'
import { useDesktopChromiumOnly } from './helpers/chromium-only'
import { completeStaffAuthToDashboard, staffCredentialsFromEnv } from './helpers/staff-login'

/**
 * Settings → Storage → Google Drive — fully mocked Google OAuth/API so this
 * spec never calls real Google endpoints or depends on live Drive credentials.
 * Only the staff login itself talks to the real (local) worker.
 */
test.describe('Settings → Storage → Google Drive (mocked Google OAuth/API)', () => {
  test.beforeEach(async ({ baseURL }) => {
    useDesktopChromiumOnly()
    test.skip(!baseURL, 'baseURL is required')
    const apiUp = await isAuthApiAvailable(baseURL!)
    skipIfApiUnavailable(apiUp)
  })

  test('shows disconnected state and starts the mocked consent flow', async ({ page }) => {
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E credentials missing')
    if (!creds?.totpSecret) return

    await completeStaffAuthToDashboard(page, creds)

    await page.route('**/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: false,
          status: null,
          googleAccountEmail: null,
          connectedAt: null,
          lastSyncedAt: null,
          isDefault: false,
          lastErrorMessage: null,
        }),
      })
    })

    let connectRequested = false
    await page.route('**/integrations/google-drive/connect', async (route) => {
      connectRequested = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1&state=mock-state',
        }),
      })
    })

    // Prevent the real navigation to the (mocked) Google consent URL from
    // leaving the test — fulfil it with a harmless page instead.
    await page.route('https://accounts.google.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>mock-google</html>' })
    })

    await page.goto('/en/settings/storage')
    await expect(page.getByText(/not connected/i).first()).toBeVisible()

    const connectButton = page.getByRole('button', { name: /connect google drive/i })
    await expect(connectButton).toBeVisible()
    await connectButton.click()

    await expect.poll(() => connectRequested).toBe(true)
    await expect(page).toHaveURL(/accounts\.google\.com/)
  })

  test('shows connected state and disconnects', async ({ page }) => {
    const creds = staffCredentialsFromEnv()
    test.skip(!creds?.totpSecret, 'E2E credentials missing')
    if (!creds?.totpSecret) return

    await completeStaffAuthToDashboard(page, creds)

    let connected = true
    await page.route('**/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected,
          status: connected ? 'CONNECTED' : 'REVOKED',
          googleAccountEmail: connected ? 'staff@example.com' : null,
          connectedAt: connected ? new Date().toISOString() : null,
          lastSyncedAt: null,
          isDefault: true,
          lastErrorMessage: null,
        }),
      })
    })

    await page.route('**/integrations/google-drive/disconnect', async (route) => {
      connected = false
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ disconnected: true }),
      })
    })

    await page.goto('/en/settings/storage')
    await expect(page.getByText(/staff@example\.com/)).toBeVisible()

    const disconnectButton = page.getByRole('button', { name: /disconnect/i })
    await disconnectButton.click()

    await expect(page.getByRole('button', { name: /connect google drive/i })).toBeVisible()
  })
})
