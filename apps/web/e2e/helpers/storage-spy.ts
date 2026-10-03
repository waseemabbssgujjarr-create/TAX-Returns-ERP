import type { Page } from '@playwright/test'

const TOKEN_KEY_PATTERN =
  /access[_-]?token|refresh[_-]?token|jwt|bearer|auth[_-]?token|id[_-]?token/i

/** Install before navigation — records localStorage/sessionStorage writes. */
export async function installStorageTokenSpies(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const hits: { storage: string; key: string; value: string }[] = []

    const wrap = (storage: Storage, name: string) => {
      const origSet = storage.setItem.bind(storage)
      storage.setItem = (key: string, value: string) => {
        hits.push({ storage: name, key, value })
        return origSet(key, value)
      }
    }

    wrap(window.localStorage, 'localStorage')
    wrap(window.sessionStorage, 'sessionStorage')
    ;(window as unknown as { __taxdeskStorageSpy?: typeof hits }).__taxdeskStorageSpy = hits
  })
}

export async function assertNoAccessTokensInWebStorage(page: Page): Promise<void> {
  const suspicious = await page.evaluate((patternSource) => {
    const pattern = new RegExp(patternSource, 'i')
    const hits =
      (
        window as unknown as {
          __taxdeskStorageSpy?: { storage: string; key: string; value: string }[]
        }
      ).__taxdeskStorageSpy ?? []

    const fromSpy = hits.filter(
      (h) => pattern.test(h.key) || (h.value.length > 20 && pattern.test(h.value)),
    )

    const scanStorage = (storage: Storage, name: string) => {
      const found: { storage: string; key: string }[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (!key) continue
        const value = storage.getItem(key) ?? ''
        if (pattern.test(key) || (value.length > 20 && pattern.test(value))) {
          found.push({ storage: name, key })
        }
      }
      return found
    }

    return [
      ...fromSpy.map((h) => ({ storage: h.storage, key: h.key })),
      ...scanStorage(localStorage, 'localStorage'),
      ...scanStorage(sessionStorage, 'sessionStorage'),
    ]
  }, TOKEN_KEY_PATTERN.source)

  if (suspicious.length > 0) {
    throw new Error(
      `Access tokens must not be stored in web storage: ${JSON.stringify(suspicious)}`,
    )
  }
}
