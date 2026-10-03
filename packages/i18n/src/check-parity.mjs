#!/usr/bin/env node
/**
 * i18n Key Parity Check
 * Compares en.json and ur.json key trees and fails if they diverge.
 * Run: node src/check-parity.mjs
 * Used in CI and as a Kiro hook on save.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const enPath = path.join(__dirname, 'locales', 'en.json')
const urPath = path.join(__dirname, 'locales', 'ur.json')

const en = JSON.parse(readFileSync(enPath, 'utf-8'))
const ur = JSON.parse(readFileSync(urPath, 'utf-8'))

/** Recursively collect all dot-separated keys */
function collectKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

const enKeys = new Set(collectKeys(en))
const urKeys = new Set(collectKeys(ur))

const missingInUr = [...enKeys].filter((k) => !urKeys.has(k))
const extraInUr   = [...urKeys].filter((k) => !enKeys.has(k))

if (missingInUr.length === 0 && extraInUr.length === 0) {
  console.log(`✓ i18n parity check passed — ${enKeys.size} keys in both en.json and ur.json`)
  process.exit(0)
} else {
  if (missingInUr.length > 0) {
    console.error(`\n✗ Keys in en.json but MISSING from ur.json (${missingInUr.length}):`)
    missingInUr.forEach((k) => console.error(`  - ${k}`))
  }
  if (extraInUr.length > 0) {
    console.error(`\n✗ Keys in ur.json but NOT in en.json (${extraInUr.length}):`)
    extraInUr.forEach((k) => console.error(`  - ${k}`))
  }
  console.error('\nFix the above before committing.')
  process.exit(1)
}
