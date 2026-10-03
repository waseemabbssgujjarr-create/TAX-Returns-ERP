import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : 2,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Desktop Chrome — auth E2E (Phase 1) uses real Chromium only
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile Chrome emulation — Pixel 5
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testIgnore: /auth-.*\.spec\.ts/,
    },
    // Mobile Safari emulation — iPhone 13
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      testIgnore: /auth-.*\.spec\.ts/,
    },
    // Tablet emulation — iPad Pro
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
      testIgnore: /auth-.*\.spec\.ts/,
    },
  ],

  // Start the Next.js dev server before running tests
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
})
