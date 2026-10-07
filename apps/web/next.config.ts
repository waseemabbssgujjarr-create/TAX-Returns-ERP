import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

const nextConfig: NextConfig = {
  // cPanel bundle: self-contained server output (see scripts/cpanel-bundle.mjs)
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  // Transpile internal workspace packages
  transpilePackages: [
    '@taxdesk/ui',
    '@taxdesk/schemas',
    '@taxdesk/tax-engine',
    '@taxdesk/rules',
    '@taxdesk/i18n',
    'framer-motion',
  ],

  // Strict mode for catching React issues early
  reactStrictMode: true,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Strict CSP — tighten per environment in production
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-eval required for Next.js webpack HMR/dev transforms; omit in hardened prod builds
              process.env.NODE_ENV === 'production'
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' ws: wss:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HSTS — only enable once HTTPS is confirmed in production
          // { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },

  // Image domains — add S3 CDN domain here when configured
  images: {
    remotePatterns: [],
  },

  // Proxy auth API to the worker so refresh cookies stay same-site (Path=/auth)
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    return [
      {
        source: '/health',
        destination: `${apiBase}/health`,
      },
      {
        source: '/auth/:path*',
        destination: `${apiBase}/auth/:path*`,
      },
      {
        source: '/clients',
        destination: `${apiBase}/clients`,
      },
      {
        source: '/clients/:path*',
        destination: `${apiBase}/clients/:path*`,
      },
      {
        source: '/documents',
        destination: `${apiBase}/documents`,
      },
      {
        source: '/documents/:path*',
        destination: `${apiBase}/documents/:path*`,
      },
      {
        source: '/analytics/:path*',
        destination: `${apiBase}/analytics/:path*`,
      },
      {
        source: '/admin/:path*',
        destination: `${apiBase}/admin/:path*`,
      },
      {
        source: '/tax-years',
        destination: `${apiBase}/tax-years`,
      },
      {
        source: '/tax-years/:path*',
        destination: `${apiBase}/tax-years/:path*`,
      },
      {
        source: '/withholding/:path*',
        destination: `${apiBase}/withholding/:path*`,
      },
      {
        source: '/exports',
        destination: `${apiBase}/exports`,
      },
      {
        source: '/exports/:path*',
        destination: `${apiBase}/exports/:path*`,
      },
      {
        source: '/portal/:path*',
        destination: `${apiBase}/portal/:path*`,
      },
      {
        source: '/notices',
        destination: `${apiBase}/notices`,
      },
      {
        source: '/notices/:path*',
        destination: `${apiBase}/notices/:path*`,
      },
      {
        source: '/compliance-events',
        destination: `${apiBase}/compliance-events`,
      },
      {
        source: '/compliance/:path*',
        destination: `${apiBase}/compliance/:path*`,
      },
      {
        source: '/invoices',
        destination: `${apiBase}/invoices`,
      },
      {
        source: '/invoices/:path*',
        destination: `${apiBase}/invoices/:path*`,
      },
      {
        source: '/storage/:path*',
        destination: `${apiBase}/storage/:path*`,
      },
      {
        source: '/integrations/:path*',
        destination: `${apiBase}/integrations/:path*`,
      },
    ]
  },

  // Experimental features
  experimental: {
    // Enable typed routes for compile-time link safety
    typedRoutes: true,
  },
}

export default withNextIntl(nextConfig)
