import { expect, test } from '@playwright/test'

import { runAxeIfAvailable } from './helpers/axe'
import { useDesktopChromiumOnly } from './helpers/chromium-only'

test.describe('marketing landing page', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  test('EN landing page loads brand and primary CTA', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')

    await page.goto('/en')

    await expect(page.locator('html')).toHaveAttribute('lang', /en/i)
    await expect(page.locator('html')).toHaveAttribute('dir', /ltr/i)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible()

    await runAxeIfAvailable(page)
  })

  test('UR landing page uses RTL document direction', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')

    await page.goto('/ur')

    const dir = await page.locator('html').getAttribute('dir')
    expect(dir?.toLowerCase()).toBe('rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', /ur/i)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await runAxeIfAvailable(page)
  })

  test('reduced-motion preference keeps the hero readable', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/en')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
  })
})
