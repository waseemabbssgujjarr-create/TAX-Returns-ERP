import { expect, test } from '@playwright/test'

import { useDesktopChromiumOnly } from './helpers/chromium-only'

test.describe('staff auth middleware', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  test('redirects /en/dashboard to /en/login without refresh cookie', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')

    await page.context().clearCookies()
    const response = await page.goto('/en/dashboard')

    expect(response?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/\/en\/login(\?|$)/)
  })
})
