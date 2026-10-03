import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

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

const firmSlug = process.env.E2E_FIRM_SLUG
const email = process.env.E2E_STAFF_EMAIL
const password = process.env.E2E_STAFF_PASSWORD

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_MIGRATIONS_URL ?? process.env.DATABASE_DIRECT_URL },
  },
})

const firmId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'

const user = await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${firmId}, true)`
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`
  await tx.$executeRaw`SELECT set_config('app.session_type', ${'staff'}, true)`
  return tx.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      isActive: true,
      failedLoginCount: true,
      lockedUntil: true,
      passwordHash: true,
      totpEnabled: true,
    },
  })
})

const passwordMatches = user?.passwordHash
  ? await bcrypt.compare(password ?? '', user.passwordHash)
  : false

const login = await fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firmSlug, email, password }),
})

process.stdout.write(
  JSON.stringify({
    env: {
      hasSlug: Boolean(firmSlug),
      hasEmail: Boolean(email),
      hasPassword: Boolean(password),
      emailLower: email?.toLowerCase(),
    },
    db: {
      found: Boolean(user),
      email: user?.email,
      isActive: user?.isActive,
      failedLoginCount: user?.failedLoginCount,
      locked: user?.lockedUntil ? user.lockedUntil > new Date() : false,
      totpEnabled: user?.totpEnabled,
      passwordMatches,
    },
    loginStatus: login.status,
    loginBody: (await login.text()).slice(0, 200),
  }) + '\n',
)

await prisma.$disconnect()
