import { test } from '@playwright/test'

/** Auth security E2E runs on desktop Chromium only (real browser, not emulators). */
export function useDesktopChromiumOnly(): void {
  test.skip(test.info().project.name !== 'chromium', 'Auth E2E runs on desktop Chromium only')
}
