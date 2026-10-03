import { createSharedPathnamesNavigation } from 'next-intl/navigation'

import { locales } from './request'

export const { Link, redirect, usePathname, useRouter } = createSharedPathnamesNavigation({
  locales: [...locales],
  localePrefix: 'always',
})
