import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { authenticator } from 'otplib'

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

const secret = process.env.E2E_TOTP_SECRET
const code = authenticator.generate(secret)

const loginRes = await fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firmSlug: process.env.E2E_FIRM_SLUG,
    email: process.env.E2E_STAFF_EMAIL,
    password: process.env.E2E_STAFF_PASSWORD,
  }),
})
const loginBody = await loginRes.json()
const verifyRes = await fetch('http://localhost:3001/auth/totp/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loginBody.accessToken}`,
  },
  body: JSON.stringify({ code }),
})

process.stdout.write(
  JSON.stringify({
    login: loginRes.status,
    verify: verifyRes.status,
    codeLen: code.length,
    localCheck: authenticator.check(code, secret),
  }) + '\n',
)
