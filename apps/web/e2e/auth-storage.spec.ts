import { test } from '@playwright/test'

import { useDesktopChromiumOnly } from './helpers/chromium-only'
import { assertNoAccessTokensInWebStorage, installStorageTokenSpies } from './helpers/storage-spy'

test.describe('auth token storage', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  test('does not persist access tokens in localStorage or sessionStorage on login page', async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL is required')

    await installStorageTokenSpies(page)
    await page.goto('/en/login')
    await page.waitForLoadState('networkidle')

    await assertNoAccessTokensInWebStorage(page)
  })
})
