import type { RedisOptions } from 'ioredis'

/** BullMQ requires this on ioredis connections (see BullMQ docs). */
const BULL_IOREDIS_BASE: Pick<RedisOptions, 'maxRetriesPerRequest' | 'enableReadyCheck'> = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}

/**
 * Parse REDIS_URL (redis:// or rediss://) into ioredis connection options.
 * Upstash production uses rediss://default:PASSWORD@HOST:6379 — TLS via rediss.
 * Does not use Upstash REST API (BullMQ needs native Redis protocol).
 */
export function connectionOptionsFromRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url)
  const port = parsed.port ? parseInt(parsed.port, 10) : 6379

  const options: RedisOptions = {
    host: parsed.hostname,
    port,
  }

  const username = decodeURIComponent(parsed.username || '')
  const password = decodeURIComponent(parsed.password || '')
  if (username) options.username = username
  if (password) options.password = password

  if (parsed.protocol === 'rediss:') {
    options.tls = {}
  }

  return options
}

/**
 * BullMQ connection options: prefer REDIS_URL (production / Upstash), else
 * REDIS_HOST + REDIS_PORT for local docker-compose.
 */
export function resolveRedisConnectionOptions(): RedisOptions {
  const url = process.env['REDIS_URL']?.trim()
  if (url) {
    return {
      ...BULL_IOREDIS_BASE,
      ...connectionOptionsFromRedisUrl(url),
    }
  }

  return {
    ...BULL_IOREDIS_BASE,
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  }
}
