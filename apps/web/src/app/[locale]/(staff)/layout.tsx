import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppTopBar } from '@/components/layout/AppTopBar'

import '@/styles/staff.css'

/**
 * Staff app shell layout.
 * Renders: top bar + collapsible sidebar + main content area.
 * The sidebar collapses to icons on tablet and is hidden (bottom tab bar) on phone —
 * those variants are handled in the sidebar component via CSS container queries.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-canvas flex min-h-svh flex-col" data-app-shell="staff">
      <AppTopBar />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main
          id="main-content"
          className="bg-canvas flex-1 overflow-y-auto focus:outline-none"
          tabIndex={-1}
        >
          {/* Max width cap on large screens — content should not stretch full width */}
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
