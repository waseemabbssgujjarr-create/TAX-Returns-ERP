import { notFound } from 'next/navigation'
import type { AbstractIntlMessages } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

// Supported locales — en (LTR) and ur (RTL)
export const locales = ['en', 'ur'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** Map locale to text direction */
export const localeDir: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ur: 'rtl',
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Next.js 15: locale must be awaited (sync headers() triggers the "1 error" badge)
  const requested = await requestLocale
  const locale = locales.includes(requested as Locale) ? (requested as Locale) : defaultLocale

  if (!locales.includes(locale)) notFound()

  const localeModule = (await import(`../../../../packages/i18n/src/locales/${locale}.json`)) as {
    default: AbstractIntlMessages
  }
  const messages = localeModule.default

  return {
    locale,
    messages,
    // Time zone for display (Pakistan Standard Time)
    timeZone: 'Asia/Karachi',
    // Use 24-hour time and PKR currency by default
    formats: {
      number: {
        pkr: {
          style: 'currency',
          currency: 'PKR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        },
      },
      dateTime: {
        short: {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
        long: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        },
      },
    },
  }
})
