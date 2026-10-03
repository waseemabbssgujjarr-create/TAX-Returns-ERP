/**
 * Client portal layout.
 * Mobile-first, minimal chrome.
 * No staff sidebar — bottom tab bar on phones, top nav on larger screens.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-subtle flex min-h-svh flex-col" dir="auto">
      <main id="main-content" className="pb-safe-bottom flex-1 px-4 pt-4" tabIndex={-1}>
        {children}
      </main>
      {/* Portal bottom tab bar (mobile) — implemented in Client Portal spec */}
    </div>
  )
}
