import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'

import { getNextLocale, LanguageSwitcher } from '@/components/auth/LanguageSwitcher'

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/login',
  Link: ({
    children,
    href,
    locale,
    onClick,
  }: {
    children: React.ReactNode
    href: string
    locale?: string
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  }) => (
    <a href={locale ? `/${locale}${href}` : href} onClick={onClick}>
      {children}
    </a>
  ),
}))

vi.mock('next-intl', async () => {
  const actual = await vi.importActual('next-intl')
  return {
    ...(actual as Record<string, unknown>),
    useLocale: () => 'en',
  }
})

const messages = {
  auth: {
    languageSwitcher: {
      label: 'Language',
      switchToEnglish: 'Switch to English',
      switchToUrdu: 'Switch to Urdu',
      englishShort: 'Eng',
      urduShort: 'Urdu',
      englishAria: 'English',
      urduAria: 'Urdu',
    },
  },
}

describe('LanguageSwitcher', () => {
  it('links to Urdu locale path', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LanguageSwitcher />
      </NextIntlClientProvider>,
    )

    const urdu = screen.getByRole('link', { name: 'Urdu' })
    expect(urdu.getAttribute('href')).toBe('/ur/login')
  })

  it('computes next locale', () => {
    expect(getNextLocale('en')).toBe('ur')
    expect(getNextLocale('ur')).toBe('en')
  })
})
