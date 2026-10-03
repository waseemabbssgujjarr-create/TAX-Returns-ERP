import { randomBytes } from 'node:crypto'

process.env['JWT_ACCESS_SECRET'] ??= randomBytes(48).toString('base64')
process.env['JWT_REFRESH_SECRET'] ??= randomBytes(48).toString('base64')
process.env['OTP_CONTACT_SECRET'] ??= randomBytes(32).toString('base64')
process.env['ENCRYPTION_MASTER_KEY'] ??= randomBytes(32).toString('base64')
