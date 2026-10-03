import { expect, test } from '@playwright/test'

import { runAxeIfAvailable } from './helpers/axe'
import { useDesktopChromiumOnly } from './helpers/chromium-only'

test.describe('accessibility + RTL smoke', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  test('EN login meets axe critical/serious bar', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')
    await page.goto('/en/login')
    await expect(page.getByRole('form')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', /en/i)
    await runAxeIfAvailable(page)
  })

  test('UR login uses RTL document direction', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')
    await page.goto('/ur/login')
    await expect(page.getByRole('form')).toBeVisible()
    const dir = await page.locator('html').getAttribute('dir')
    expect(dir?.toLowerCase()).toBe('rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', /ur/i)
    await runAxeIfAvailable(page)
  })

  test('reduced-motion preference keeps keyboard focus order', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/en/login')
    await expect(page.getByRole('form')).toBeVisible()
    await page.locator('#email').focus()
    await expect(page.locator('#email')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('#password')).toBeFocused()
  })
})
