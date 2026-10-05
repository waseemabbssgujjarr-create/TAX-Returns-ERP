import { afterEach, describe, expect, it } from 'vitest'

import { validateEnv } from './env.validation'

const baseProductionEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:secret@db.example.com:5432/iqpigeon_taxdesk_app',
  REDIS_URL: 'rediss://default:token@upstash.example:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  ENCRYPTION_MASTER_KEY: Buffer.alloc(32).toString('base64'),
  OTP_CONTACT_SECRET: Buffer.alloc(32).toString('base64'),
  OPENAI_API_KEY: 'sk-test-not-real',
  STORAGE_DRIVER: 'google-drive',
  GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
  GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://api.tax.aderalabs.tech/integrations/google-drive/callback',
  WORKER_PUBLIC_URL: 'https://api.tax.aderalabs.tech',
})

describe('validateEnv production', () => {
  const keys = Object.keys(baseProductionEnv())

  afterEach(() => {
    for (const k of keys) delete process.env[k]
  })

  it('accepts a complete production env including Upstash REDIS_URL', () => {
    Object.assign(process.env, baseProductionEnv())
    expect(() => validateEnv()).not.toThrow()
  })

  it('rejects production without REDIS_URL', () => {
    Object.assign(process.env, baseProductionEnv())
    delete process.env['REDIS_URL']
    expect(() => validateEnv()).toThrow(/REDIS_URL/)
  })

  it('rejects production without OPENAI_API_KEY', () => {
    Object.assign(process.env, baseProductionEnv(), { OPENAI_API_KEY: '' })
    expect(() => validateEnv()).toThrow(/OPENAI_API_KEY/)
  })

  it('does not require DATABASE_MIGRATIONS_URL at worker runtime', () => {
    Object.assign(process.env, baseProductionEnv())
    delete process.env['DATABASE_MIGRATIONS_URL']
    delete process.env['DATABASE_DIRECT_URL']
    expect(() => validateEnv()).not.toThrow()
  })
})
