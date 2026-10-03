import { AdminSubNav } from '@/components/admin/AdminSubNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="bg-canvas/90 sticky top-0 z-10 -mx-1 px-1 pb-2 pt-1 backdrop-blur-sm">
        <AdminSubNav />
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}
