/**
 * Runs Husky git-hook setup after install in local/dev.
 * Skipped in production (cPanel) so `pnpm install` never fails when Husky
 * is omitted or unavailable.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.env.NODE_ENV === 'production') {
  process.exit(0)
}

const huskyEntry = path.join(root, 'node_modules', 'husky', 'bin.js')
if (!existsSync(huskyEntry)) {
  process.exit(0)
}

const result = spawnSync(process.execPath, [huskyEntry], {
  cwd: root,
  stdio: 'inherit',
})

process.exit(result.status ?? (result.error ? 1 : 0))
