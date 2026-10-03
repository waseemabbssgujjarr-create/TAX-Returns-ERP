/**
 * Run Playwright document hub API suite (chromium).
 * Usage: node apps/worker/scripts/run-documents-e2e.mjs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const webDir = path.join(root, 'apps', 'web')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(path.join(root, '.env'))
loadEnvFile(path.join(root, '.env.e2e.local'))

process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? 'local'
process.env.PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
process.env.WORKER_URL = process.env.WORKER_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
process.env.E2E_FIRM_SLUG = process.env.E2E_FIRM_SLUG ?? process.env.SEED_FIRM_SLUG
process.env.E2E_STAFF_EMAIL =
  process.env.E2E_STAFF_EMAIL ?? process.env.E2E_USER_EMAIL ?? process.env.SEED_STAFF_EMAIL
process.env.E2E_STAFF_PASSWORD =
  process.env.E2E_STAFF_PASSWORD ?? process.env.E2E_USER_PASSWORD ?? process.env.SEED_STAFF_PASSWORD

console.log(
  JSON.stringify({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    worker: process.env.WORKER_URL,
    storageDriver: process.env.STORAGE_DRIVER,
    hasFirm: Boolean(process.env.E2E_FIRM_SLUG),
    hasEmail: Boolean(process.env.E2E_STAFF_EMAIL),
    hasPassword: Boolean(process.env.E2E_STAFF_PASSWORD),
    hasTotp: Boolean(process.env.E2E_TOTP_SECRET),
  }),
)

const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--project=chromium', 'e2e/documents-hub.spec.ts'],
  {
    cwd: webDir,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  },
)

process.exit(result.status ?? 1)
