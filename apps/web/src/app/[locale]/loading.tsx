/**
 * Route-level loading skeleton.
 * Shown while a page's async Server Component is being fetched.
 */
export default function Loading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading">
      {/* Page header skeleton */}
      <div className="skeleton h-8 w-48 rounded-md" />
      <div className="skeleton h-4 w-72 rounded-md" />

      {/* Content skeleton rows */}
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}
