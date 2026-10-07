/**
 * Verify dist/cpanel/web and dist/cpanel/worker after cpanel:bundle.
 */
import { existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webOut = path.join(root, 'dist', 'cpanel', 'web')
const workerOut = path.join(root, 'dist', 'cpanel', 'worker')

function assertPath(label, p) {
  if (!existsSync(p)) {
    console.error(`✗ missing ${label}: ${p}`)
    process.exit(1)
  }
  console.log(`✓ ${label}`)
}

function findQueryEngine(dir) {
  if (!existsSync(dir)) return null
  for (const name of readdirSync(dir)) {
    if (name.startsWith('libquery_engine') && name.includes('debian')) {
      return path.join(dir, name)
    }
  }
  return null
}

assertPath('web server.cjs', path.join(webOut, 'server.cjs'))
assertPath('web standalone server', path.join(webOut, 'apps', 'web', 'server.js'))
assertPath('web static assets', path.join(webOut, 'apps', 'web', '.next', 'static'))

assertPath('worker dist/main.js', path.join(workerOut, 'dist', 'main.js'))
assertPath('worker node_modules', path.join(workerOut, 'node_modules'))

const prismaClientDir = path.join(workerOut, 'node_modules', '.prisma', 'client')
assertPath('worker Prisma client', prismaClientDir)
const linuxEngine = findQueryEngine(prismaClientDir)
if (!linuxEngine) {
  console.error('✗ missing Linux Prisma query engine in worker bundle (.prisma/client)')
  process.exit(1)
}
console.log(`✓ worker Linux Prisma engine: ${path.basename(linuxEngine)}`)

for (const file of [
  path.join(webOut, 'server.cjs'),
  path.join(workerOut, 'dist', 'main.js'),
]) {
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (check.status !== 0) {
    console.error(`✗ syntax check failed: ${file}\n${check.stderr}`)
    process.exit(1)
  }
  console.log(`✓ syntax ${path.basename(file)}`)
}

console.log('\n✓ cPanel bundle verification passed')
