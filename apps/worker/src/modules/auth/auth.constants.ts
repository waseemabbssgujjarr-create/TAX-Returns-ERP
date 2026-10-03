/** bcrypt cost for password hashes (login compare uses stored hash; dummy uses same cost). */
export const BCRYPT_PASSWORD_COST = 12

export const BCRYPT_OTP_COST = 10

export const MAX_PASSWORD_FAILURES = 3

export const LOCK_DURATION_MS = 30 * 60 * 1000

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials.'

/** Timing equalisation when user record is missing. */
export const DUMMY_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G2oYQ5.5K5K5K5u'

export const UNKNOWN_FIRM_DELAY_MS = 250

export const REFRESH_TOKEN_TTL_DAYS = 7

export const OTP_SEND_LIMIT_PER_HOUR = 3

export const OTP_MAX_VERIFY_ATTEMPTS = 3

export const OTP_TTL_MS = 10 * 60 * 1000
