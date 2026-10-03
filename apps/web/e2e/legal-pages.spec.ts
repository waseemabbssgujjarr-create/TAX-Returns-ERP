import { expect, test } from '@playwright/test'

import { runAxeIfAvailable } from './helpers/axe'
import { useDesktopChromiumOnly } from './helpers/chromium-only'

test.describe('legal pages', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  for (const locale of ['en', 'ur'] as const) {
    test(`privacy ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/privacy`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('status')).toBeVisible()
      if (locale === 'ur') {
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      } else {
        await expect(page.getByRole('status')).toContainText(/legal review/i)
      }
      await runAxeIfAvailable(page)
    })

    test(`terms ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/terms`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('status')).toBeVisible()
      if (locale === 'ur') {
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      } else {
        await expect(page.getByRole('status')).toContainText(/legal review/i)
      }
      await runAxeIfAvailable(page)
    })
  }
})
