export default function ActivityLoading() {
  return (
    <div className="flex-1 animate-pulse space-y-4 p-6">
      {/* Topbar skeleton */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="h-6 w-36 rounded-lg bg-gray-200" />
        <div className="h-8 w-32 rounded-xl bg-gray-200" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 min-w-48 flex-1 rounded-xl border border-gray-200 bg-white" />
        <div className="h-10 w-40 rounded-xl border border-gray-200 bg-white" />
        <div className="h-10 w-36 rounded-xl border border-gray-200 bg-white" />
        <div className="h-10 w-36 rounded-xl border border-gray-200 bg-white" />
        <div className="h-10 w-28 rounded-xl border border-gray-200 bg-white" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3">
          {[100, 100, 200, 120].map((w, i) => (
            <div key={i} className="h-3 rounded bg-gray-200" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-4 py-3">
            <div className="h-6 w-24 rounded-full bg-gray-200" />
            <div className="h-3.5 w-28 rounded bg-gray-200" />
            <div className="h-3.5 w-56 rounded bg-gray-200" />
            <div className="h-3.5 w-24 rounded bg-gray-200" />
          </div>
        ))}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="h-3 w-20 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
