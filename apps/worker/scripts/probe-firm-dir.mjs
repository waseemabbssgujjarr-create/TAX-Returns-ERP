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

async function dump(label, url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const dir = await prisma.$queryRaw`SELECT firm_id::text AS firm_id, slug, is_active FROM firm_directory`
    const firms = await prisma.$queryRaw`SELECT id::text AS id, slug, is_active FROM firms`
    process.stdout.write(JSON.stringify({ label, dir, firms }) + '\n')
  } catch (e) {
    process.stdout.write(JSON.stringify({ label, err: e.message }) + '\n')
  } finally {
    await prisma.$disconnect()
  }
}

await dump('app', process.env.DATABASE_URL)
await dump('migrations', process.env.DATABASE_MIGRATIONS_URL ?? process.env.DATABASE_DIRECT_URL)
