import { expect, test } from '@playwright/test'

import { runAxeIfAvailable } from './helpers/axe'
import { useDesktopChromiumOnly } from './helpers/chromium-only'

test.describe('marketing contact and signup', () => {
  test.beforeEach(() => {
    useDesktopChromiumOnly()
  })

  test('contact page form EN', async ({ page }) => {
    await page.goto('/en/contact')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.locator('#contact-name').fill('Test User')
    await page.locator('#contact-email').fill('test@example.com')
    await page.locator('#contact-firm').fill('Demo Firm')
    await page.locator('#contact-phone').fill('+923001234567')
    await page.locator('#contact-message').fill('Looking for a TaxDesk PK demo for our Lahore practice.')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 })
    await runAxeIfAvailable(page, { include: '#main-content' })
  })

  test('signup page form EN', async ({ page }) => {
    await page.goto('/en/signup')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.locator('#signup-firm').fill('Demo Tax Associates')
    await page.locator('#signup-contact').fill('Ayesha Khan')
    await page.locator('#signup-email').fill('ayesha@example.com')
    await page.locator('#signup-phone').fill('+923001234567')
    await page.locator('#signup-city').fill('Islamabad')
    await page.getByRole('button', { name: /request access|submit|sign up/i }).click()
    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 })
    await runAxeIfAvailable(page, { include: '#main-content' })
  })

  test('contact UR RTL', async ({ page }) => {
    await page.goto('/ur/contact')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
