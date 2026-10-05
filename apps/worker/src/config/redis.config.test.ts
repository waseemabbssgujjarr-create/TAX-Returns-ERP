import { afterEach, describe, expect, it } from 'vitest'

import { connectionOptionsFromRedisUrl, resolveRedisConnectionOptions } from './redis.config'

describe('redis.config', () => {
  afterEach(() => {
    delete process.env['REDIS_URL']
    delete process.env['REDIS_HOST']
    delete process.env['REDIS_PORT']
  })

  it('parses Upstash-style rediss:// URL with TLS and credentials', () => {
    const opts = connectionOptionsFromRedisUrl(
      'rediss://default:secret-pass@us1-example.upstash.io:6379',
    )
    expect(opts.host).toBe('us1-example.upstash.io')
    expect(opts.port).toBe(6379)
    expect(opts.username).toBe('default')
    expect(opts.password).toBe('secret-pass')
    expect(opts.tls).toEqual({})
  })

  it('parses local redis:// without TLS', () => {
    const opts = connectionOptionsFromRedisUrl('redis://localhost:6379')
    expect(opts.host).toBe('localhost')
    expect(opts.port).toBe(6379)
    expect(opts.tls).toBeUndefined()
  })

  it('prefers REDIS_URL over REDIS_HOST when set', () => {
    process.env['REDIS_URL'] = 'rediss://default:pw@upstash.example:6379'
    process.env['REDIS_HOST'] = 'should-not-use'
    process.env['REDIS_PORT'] = '9999'

    const opts = resolveRedisConnectionOptions()
    expect(opts.host).toBe('upstash.example')
    expect(opts.port).toBe(6379)
    expect(opts.maxRetriesPerRequest).toBeNull()
    expect(opts.tls).toEqual({})
  })

  it('falls back to REDIS_HOST/REDIS_PORT when REDIS_URL is unset', () => {
    delete process.env['REDIS_URL']
    process.env['REDIS_HOST'] = '127.0.0.1'
    process.env['REDIS_PORT'] = '6380'

    const opts = resolveRedisConnectionOptions()
    expect(opts.host).toBe('127.0.0.1')
    expect(opts.port).toBe(6380)
    expect(opts.maxRetriesPerRequest).toBeNull()
  })
})
