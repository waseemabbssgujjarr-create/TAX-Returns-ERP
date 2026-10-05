const firmSettingsPath = (locale: string) => `/${locale}/admin/firm-settings`

/** Staff sidebar: firm settings vs broader admin section are separate highlights. */
export function isStaffNavActive(pathname: string, locale: string, href: string): boolean {
  const base = `/${locale}/${href}`
  const firm = firmSettingsPath(locale)

  if (href === 'admin/firm-settings') {
    return pathname === firm || pathname.startsWith(`${firm}/`)
  }

  if (href.startsWith('admin/')) {
    return pathname.startsWith(`/${locale}/admin`) && !pathname.startsWith(firm)
  }

  if (href.startsWith('settings/')) {
    return pathname.startsWith(`/${locale}/settings`)
  }

  return pathname === base || pathname.startsWith(`${base}/`)
}
