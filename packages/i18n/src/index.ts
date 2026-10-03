/**
 * @taxdesk/i18n
 * Re-exports locale data for use in apps.
 * next-intl loads locale files directly; this index is for programmatic use.
 */

import en from './locales/en.json'
import ur from './locales/ur.json'

export { en, ur }

export const locales = ['en', 'ur'] as const
export type Locale = (typeof locales)[number]

export const messages: Record<Locale, typeof en> = { en, ur: ur as typeof en }
