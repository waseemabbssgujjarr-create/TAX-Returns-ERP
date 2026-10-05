/** Admin section routes — shared by AdminSubNav and staff sidebar entry points. */
export const ADMIN_NAV_ITEMS = [
  { segment: 'firm-settings', labelKey: 'adminFirmSettings' },
  { segment: 'users', labelKey: 'adminUsers' },
  { segment: 'roles', labelKey: 'adminRoles' },
  { segment: 'sessions', labelKey: 'adminSessions' },
  { segment: 'audit-logs', labelKey: 'adminAudit' },
  { segment: 'security-events', labelKey: 'adminSecurity' },
  { segment: 'integrations', labelKey: 'adminIntegrations' },
  { segment: 'storage', labelKey: 'adminStorage' },
] as const

export type AdminNavSegment = (typeof ADMIN_NAV_ITEMS)[number]['segment']
