/**
 * Build low-memory cPanel deployment bundles (run on a dev/CI machine — not on cPanel).
 *
 * Outputs:
 *   dist/cpanel/web    — Next.js standalone + static + public (Node 20 Linux)
 *   dist/cpanel/worker — NestJS dist + production node_modules + Prisma Linux engines
 *
 * Upload these folders to the server; no pnpm install required on cPanel.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pnpmCli = path.join(root, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
const outRoot = path.join(root, 'dist', 'cpanel')
const webOut = path.join(outRoot, 'web')
const workerOut = path.join(outRoot, 'worker')

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...opts,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runPnpm(args, opts = {}) {
  run(process.execPath, [pnpmCli, ...args], opts)
}

function copyDir(src, dest) {
  mkdirSync(path.dirname(dest), { recursive: true })
  cpSync(src, dest, { recursive: true, force: true })
}

function syncGeneratedPrismaClient(deployRoot) {
  const req = createRequire(path.join(root, 'package.json'))
  const prismaPkgDir = path.dirname(req.resolve('@prisma/client/package.json'))
  const prismaEngines = path.resolve(prismaPkgDir, '..', '..', '.prisma', 'client')
  if (!existsSync(prismaEngines)) {
    throw new Error('Missing generated .prisma/client — run prisma generate first')
  }
  const destModules = path.join(deployRoot, 'node_modules')
  const destEngines = path.join(destModules, '.prisma', 'client')
  const destClient = path.join(destModules, '@prisma', 'client')
  rmSync(destEngines, { recursive: true, force: true })
  rmSync(destClient, { recursive: true, force: true })
  copyDir(prismaEngines, destEngines)
  copyDir(prismaPkgDir, destClient)
}

function bundleWeb() {
  const standaloneSrc = path.join(root, 'apps', 'web', '.next', 'standalone')
  if (!existsSync(standaloneSrc)) {
    throw new Error('Missing apps/web/.next/standalone — run next build with output: standalone')
  }
  rmSync(webOut, { recursive: true, force: true })
  mkdirSync(webOut, { recursive: true })
  copyDir(standaloneSrc, webOut)

  const staticSrc = path.join(root, 'apps', 'web', '.next', 'static')
  const staticDest = path.join(webOut, 'apps', 'web', '.next', 'static')
  copyDir(staticSrc, staticDest)

  const publicSrc = path.join(root, 'apps', 'web', 'public')
  if (existsSync(publicSrc)) {
    copyDir(publicSrc, path.join(webOut, 'apps', 'web', 'public'))
  }

  const launcher = `'use strict';
const port = Number(process.env.PORT);
if (!Number.isFinite(port) || port <= 0) {
  console.error('PORT must be set by the cPanel Node.js application.');
  process.exit(1);
}
process.env.HOSTNAME = '0.0.0.0';
process.chdir(__dirname);
require('./apps/web/server.js');
`
  writeFileSync(path.join(webOut, 'server.cjs'), launcher, 'utf8')

  writeFileSync(
    path.join(webOut, 'README-DEPLOY.txt'),
    [
      'TaxDesk PK — Web (Next.js standalone)',
      'Start on cPanel Node 20: server.cjs (application root = this folder)',
      'Requires: PORT, NEXT_PUBLIC_* env vars (see docs/cpanel-tax-aderalabs.md)',
      '',
    ].join('\n'),
    'utf8',
  )
}

function bundleWorker() {
  const workerPkgDir = path.join(root, 'apps', 'worker')
  rmSync(path.join(workerPkgDir, 'dist', 'cpanel'), { recursive: true, force: true })

  rmSync(workerOut, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
  mkdirSync(path.dirname(workerOut), { recursive: true })

  const deployTarget = path.relative(workerPkgDir, workerOut)
  const deploy = spawnSync(process.execPath, [pnpmCli, 'deploy', '--filter=@taxdesk/worker', '--prod', deployTarget], {
    cwd: workerPkgDir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  })
  const workerModules = path.join(workerOut, 'node_modules')
  if (!existsSync(workerModules)) {
    process.exit(deploy.status ?? 1)
  }
  if (deploy.status !== 0) {
    console.warn(
      '⚠ pnpm deploy exited non-zero (common on Windows when linking node_modules/.bin); production start uses node dist/main.js only.',
    )
    rmSync(path.join(workerOut, 'node_modules', '.bin'), { recursive: true, force: true })
  }
  rmSync(path.join(workerOut, 'dist', 'cpanel'), { recursive: true, force: true })

  const workerDist = path.join(root, 'apps', 'worker', 'dist')
  if (!existsSync(path.join(workerDist, 'main.js'))) {
    throw new Error('Worker bundle missing apps/worker/dist/main.js — build @taxdesk/worker first')
  }
  copyDir(workerDist, path.join(workerOut, 'dist'))

  syncGeneratedPrismaClient(workerOut)

  const pkg = JSON.parse(readFileSync(path.join(workerOut, 'package.json'), 'utf8'))
  pkg.scripts = { start: 'node dist/main.js' }
  writeFileSync(path.join(workerOut, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

  writeFileSync(
    path.join(workerOut, 'README-DEPLOY.txt'),
    [
      'TaxDesk PK — API / Worker (NestJS)',
      'Start on cPanel Node 20: node dist/main.js (or npm start)',
      'Bind: PORT from cPanel (fallback WORKER_PORT / 3001 in app code)',
      'Requires runtime env only — no DATABASE_MIGRATIONS_URL on running process',
      '',
    ].join('\n'),
    'utf8',
  )
}

function writeRootReadme() {
  writeFileSync(
    path.join(outRoot, 'README-DEPLOY.txt'),
    [
      'TaxDesk PK — cPanel production bundles',
      '',
      'Generated by: pnpm cpanel:bundle (from repo root on a build machine)',
      '',
      'web/    → upload to tax.aderalabs.tech Node app (startup: server.cjs)',
      'worker/ → upload to api.tax.aderalabs.tech Node app (startup: dist/main.js)',
      '',
      'Do not run pnpm install on the server — upload the complete folder contents.',
      'Run prisma migrate on deploy using DATABASE_MIGRATIONS_URL from your workstation or SSH.',
      '',
    ].join('\n'),
    'utf8',
  )
}

console.log('→ prisma generate (includes Linux query engines)')
runPnpm(['prisma:generate'])

console.log('→ build packages + worker (sequential)')
runPnpm([
  '-r',
  '--workspace-concurrency=1',
  '--filter',
  '!@taxdesk/web',
  'build',
])

console.log('→ build web (Next.js standalone)')
const webDir = path.join(root, 'apps', 'web')
const webRequire = createRequire(path.join(webDir, 'package.json'))
const nextBin = webRequire.resolve('next/dist/bin/next')
const patchPreload = path.join(root, 'scripts', 'patch-fs-symlink-copy.cjs')
run(process.execPath, ['-r', patchPreload, nextBin, 'build'], { cwd: webDir })

console.log('→ packaging dist/cpanel/web …')
bundleWeb()

console.log('→ packaging dist/cpanel/worker …')
bundleWorker()

writeRootReadme()
console.log('\n✓ cPanel bundles ready at dist/cpanel/{web,worker}')
