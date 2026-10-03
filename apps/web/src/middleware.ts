import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

import { defaultLocale, locales } from './i18n/request'

const REFRESH_COOKIE = 'refresh_token'
/** Presence flag (Path=/) — refresh_token itself is Path=/auth and is not sent to page navigations. */
const SESSION_PRESENCE_COOKIE = 'td_session'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

const PUBLIC_AUTH_PATHS = new Set(['/login', '/2fa', '/2fa-setup', '/recover', '/password-reset'])

function stripLocale(pathname: string): { locale: string; path: string } {
  const segments = pathname.split('/').filter(Boolean)
  const maybeLocale = segments[0]
  if (maybeLocale && locales.includes(maybeLocale as (typeof locales)[number])) {
    const rest = segments.slice(1)
    return { locale: maybeLocale, path: rest.length ? `/${rest.join('/')}` : '/' }
  }
  return { locale: defaultLocale, path: pathname }
}

function isStaffProtected(path: string): boolean {
  if (PUBLIC_AUTH_PATHS.has(path)) return false
  if (path.startsWith('/portal')) return false
  if (path === '/') return false
  const staffPrefixes = [
    '/dashboard',
    '/clients',
    '/documents',
    '/calendar',
    '/billing',
    '/firm',
    '/settings',
    '/admin',
    '/tax-years',
  ]
  return staffPrefixes.some((p) => path === p || path.startsWith(`${p}/`))
}

function isPortalProtected(path: string): boolean {
  if (path === '/portal/login') return false
  return path.startsWith('/portal')
}

export default function middleware(request: NextRequest) {
  const { locale, path } = stripLocale(request.nextUrl.pathname)
  const hasRefreshCookie = Boolean(
    request.cookies.get(SESSION_PRESENCE_COOKIE)?.value ??
      request.cookies.get(REFRESH_COOKIE)?.value,
  )

  if (isStaffProtected(path) && !hasRefreshCookie) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  if (isPortalProtected(path) && !hasRefreshCookie) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/portal/login`
    return NextResponse.redirect(url)
  }

  return intlMiddleware(request)
}

export const config = {
  // Bypass locale middleware for Next rewrites to the worker API
  matcher: [
    '/((?!_next|api|auth|health|clients|documents|analytics|admin|tax-years|withholding|exports|portal|storage|notices|compliance-events|compliance|invoices|.*\\..*).*)',
  ],
}
