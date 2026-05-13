'use client'

import { useState, useMemo } from 'react'
import { Search, Download, X } from 'lucide-react'
import { exportToCSV } from '@/lib/export/csv'
import { toast } from 'sonner'
import type { ActivityLog } from '@/types'
import { cn } from '@/lib/utils'

const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  submitted: { icon: '📋', label: 'تقديم طلب', color: 'bg-blue-100 text-blue-700' },
  approved: { icon: '✅', label: 'تأهيل عميل', color: 'bg-green-100 text-green-700' },
  rejected: { icon: '❌', label: 'عدم تأهيل', color: 'bg-red-100 text-red-700' },
  lead_created: { icon: '🆕', label: 'عميل جديد', color: 'bg-blue-100 text-blue-700' },
  lead_assigned: { icon: '👤', label: 'تعيين مسؤول', color: 'bg-purple-100 text-purple-700' },
  status_changed: {
    icon: '🔄',
    label: 'تغيير حالة',
    color: 'bg-amber-100 text-amber-700',
  },
  note_added: { icon: '📝', label: 'إضافة ملاحظة', color: 'bg-orange-100 text-orange-700' },
}

export default function ActivityClient({ initialLogs }: { initialLogs: ActivityLog[] }) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Pre-compute serialized metadata once per log list so the filter function
  // never calls JSON.stringify() on every keystroke (was O(n) per character typed).
  const metadataStrings = useMemo(
    () => initialLogs.map((log) => JSON.stringify(log.metadata).toLowerCase()),
    [initialLogs]
  )

  const filtered = initialLogs.filter((log, i) => {
    const q = search.trim().toLowerCase()
    const matchQ =
      !q ||
      (log.actor?.full_name ?? '').toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      metadataStrings[i].includes(q)
    const matchAction = actionFilter === 'all' || log.action === actionFilter
    const matchFrom = !dateFrom || new Date(log.created_at) >= new Date(dateFrom)
    const matchTo = !dateTo || new Date(log.created_at) <= new Date(dateTo + 'T23:59:59')
    return matchQ && matchAction && matchFrom && matchTo
  })

  function handleExport() {
    const rows = filtered.map((log) => ({
      التاريخ: new Date(log.created_at).toLocaleString('ar-SA'),
      الإجراء: ACTION_META[log.action]?.label ?? log.action,
      المنفذ: log.actor?.full_name ?? 'النظام',
      النوع: log.entity_type,
      المعرف: log.entity_id ?? '',
      التفاصيل: JSON.stringify(log.metadata),
    }))
    exportToCSV(rows, `سجل-النشاطات-${new Date().toISOString().slice(0, 10)}`)
    toast.success(`تم تصدير ${rows.length} سجل`)
  }

  const uniqueActions = Array.from(new Set(initialLogs.map((l) => l.action)))

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="focus:border-brand rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none"
        >
          <option value="all">جميع الإجراءات</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>
              {ACTION_META[a]?.label ?? a}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="focus:border-brand rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="focus:border-brand rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('')
              setDateTo('')
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}

        <button
          onClick={handleExport}
          className="hover:border-brand flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 transition-colors"
        >
          <Download size={14} />
          تصدير CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['الإجراء', 'المنفذ', 'التفاصيل', 'التاريخ'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-gray-400">
                    لا توجد نتائج.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => {
                  const meta = ACTION_META[log.action] ?? {
                    icon: '•',
                    label: log.action,
                    color: 'bg-gray-100 text-gray-600',
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const details = log.metadata as any
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                            meta.color
                          )}
                        >
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="text-navy-900 px-4 py-3 text-sm">
                        {log.actor?.full_name ?? 'النظام'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="max-w-xs truncate text-xs text-gray-500">
                          {details?.full_name && `${details.full_name} `}
                          {details?.city && `(${details.city}) `}
                          {details?.name && `${details.name} `}
                          {details?.old_status &&
                            `${details.old_status} → ${details.new_status ?? details.status}`}
                          {details?.old_quota !== undefined &&
                            `${details.old_quota} → ${details.new_quota}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-sans text-xs whitespace-nowrap text-gray-400">
                        {new Date(log.created_at).toLocaleString('ar-SA')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">{filtered.length} سجل</p>
        </div>
      </div>
    </div>
  )
}
