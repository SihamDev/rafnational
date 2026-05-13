export default function DashboardLoading() {
  return (
    <div className="flex-1 animate-pulse space-y-6 p-6">
      {/* Topbar skeleton */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="h-6 w-36 rounded-lg bg-gray-200" />
        <div className="h-8 w-32 rounded-xl bg-gray-200" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 h-4 w-24 rounded bg-gray-200" />
            <div className="h-8 w-16 rounded-lg bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 h-4 w-48 rounded bg-gray-200" />
          <div className="h-48 rounded-xl bg-gray-100" />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 h-4 w-32 rounded bg-gray-200" />
          <div className="mx-auto h-48 w-48 rounded-full bg-gray-100" />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="h-4 w-32 rounded bg-gray-200" />
            </div>
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between px-5 py-3">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-gray-200" />
                    <div className="h-3 w-20 rounded bg-gray-100" />
                  </div>
                  <div className="h-6 w-16 rounded-full bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
