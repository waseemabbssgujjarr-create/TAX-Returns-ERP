import type { Metadata, Viewport } from 'next'
import { Gulzar, Inter } from 'next/font/google'
import localFont from 'next/font/local'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'

import { AppProviders } from '@/components/providers/AppProviders'
import { localeDir, locales } from '@/i18n/request'
import type { Locale } from '@/i18n/request'

import '@/styles/globals.css'

// ── Fonts ────────────────────────────────────────────────────────────────────
// Inter for Latin; Gulzar is a Nastaliq fallback for Urdu script (see globals.css).
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const gulzar = Gulzar({
  weight: '400',
  subsets: ['arabic'],
  variable: '--font-gulzar',
  display: 'swap',
})

const nooriNastaleeq = localFont({
  src: '../../../public/fonts/Jameel-Noori-Nastaleeq.woff',
  variable: '--font-noori',
  display: 'swap',
  fallback: ['Gulzar', 'serif'],
})

// ── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })

  return {
    title: {
      template: `%s | ${t('appName')}`,
      default: t('appName'),
    },
    description: t('description'),
    manifest: '/manifest.webmanifest',
    icons: {
      icon: '/icons/icon-192.png',
      apple: '/icons/apple-touch-icon.png',
    },
    // Open Graph
    openGraph: {
      type: 'website',
      siteName: t('appName'),
    },
  }
}

export const viewport: Viewport = {
  // Prevents auto-zoom on input focus on iOS (min 16px font enforced via CSS)
  width: 'device-width',
  initialScale: 1,
  // Support safe-area insets (notch, home indicator)
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0d6b5e' },
    { media: '(prefers-color-scheme: dark)', color: '#0a4f45' },
  ],
}

// ── Static params ─────────────────────────────────────────────────────────────
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

// ── Root Layout ───────────────────────────────────────────────────────────────
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = localeParam as Locale

  // Validate locale — 404 for anything unsupported
  if (!locales.includes(locale)) notFound()

  const messages = await getMessages({ locale })
  const dir = localeDir[locale]

  return (
    <html
      lang={locale}
      dir={dir}
      // data-density consumed by CSS for comfortable/compact mode
      data-density="comfortable"
      // Theme is set by a script in globals.css to avoid flash
      suppressHydrationWarning
    >
      <head>
        {/* Skip-to-content link target is rendered by each page layout */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {locale === 'ur' ? (
          <link
            rel="preload"
            href="/fonts/Jameel-Noori-Nastaleeq.woff"
            as="font"
            type="font/woff"
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body
        className={`${inter.variable} ${gulzar.variable} ${nooriNastaleeq.variable} font-sans antialiased`}
        // Suppress mismatch from theme script
        suppressHydrationWarning
      >
        {/* Skip to main content — accessibility requirement */}
        <a
          href="#main-content"
          className="focus:bg-surface focus:ring-primary sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-offset-2"
        >
          Skip to main content
        </a>

        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
