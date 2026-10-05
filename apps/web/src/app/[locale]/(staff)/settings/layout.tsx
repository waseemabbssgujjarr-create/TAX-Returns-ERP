import { SettingsSubNav } from '@/components/settings/SettingsSubNav'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SettingsSubNav />
      {children}
    </div>
  )
}
