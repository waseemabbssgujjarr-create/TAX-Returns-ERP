import { expect, test } from '@playwright/test'

import { runAxeIfAvailable } from './helpers/axe'
import { useDesktopChromiumOnly } from './helpers/chromium-only'

test.describe('staff login page', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  test('loads login form with firm, email, and password fields', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')

    await page.goto('/en/login')

    await expect(page.getByRole('form')).toBeVisible()
    await expect(page.locator('#firmSlug')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await runAxeIfAvailable(page)
  })
})
