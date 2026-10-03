/**
 * Loads .env + .env.e2e.local then spawns a command with that env.
 * Usage: node load-env-and-run.mjs -- <command> [args...]
 * Does not print secret values.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

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

const sep = process.argv.indexOf('--')
const cmdArgs = sep >= 0 ? process.argv.slice(sep + 1) : process.argv.slice(2)
if (cmdArgs.length === 0) {
  console.error('Usage: node load-env-and-run.mjs -- <command> [args...]')
  process.exit(1)
}

const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
