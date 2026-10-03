import {
  Building2,
  CalendarDays,
  FileStack,
  FileText,
  LayoutDashboard,
  Receipt,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface StaffNavItem {
  labelKey: string
  href: string
  icon: LucideIcon
  shortcut?: string
}

export const STAFF_NAV_ITEMS: StaffNavItem[] = [
  { labelKey: 'dashboard', href: 'dashboard', icon: LayoutDashboard, shortcut: 'G D' },
  { labelKey: 'clients', href: 'clients', icon: Users, shortcut: 'G C' },
  { labelKey: 'returns', href: 'returns', icon: FileStack, shortcut: 'G R' },
  { labelKey: 'documents', href: 'documents', icon: FileText, shortcut: 'G F' },
  { labelKey: 'calendar', href: 'calendar', icon: CalendarDays, shortcut: 'G L' },
  { labelKey: 'billing', href: 'billing', icon: Receipt, shortcut: 'G B' },
  { labelKey: 'firm', href: 'admin/firm-settings', icon: Building2, shortcut: 'G S' },
  { labelKey: 'admin', href: 'admin/users', icon: Shield, shortcut: 'G A' },
]
