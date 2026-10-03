import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}
loadEnvFile(path.join(root, '.env'))
loadEnvFile(path.join(root, '.env.e2e.local'))

const app = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
const firmId = '11111111-1111-4111-8111-111111111111'
const preAuth = '00000000-0000-0000-0000-000000000001'
const email = process.env.E2E_STAFF_EMAIL.toLowerCase()

const dir = await app.$queryRaw`SELECT firm_id::text AS firm_id, slug, is_active FROM firm_directory WHERE slug = ${process.env.E2E_FIRM_SLUG}`
const underPreAuth = await app.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${firmId}, true)`
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${preAuth}, true)`
  await tx.$executeRaw`SELECT set_config('app.session_type', ${'staff'}, true)`
  return tx.user.findUnique({
    where: { firmId_email: { firmId, email } },
    select: { id: true, email: true },
  })
})

process.stdout.write(JSON.stringify({ dir, underPreAuth }) + '\n')
await app.$disconnect()
