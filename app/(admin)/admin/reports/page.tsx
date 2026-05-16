import { createClient } from '@/lib/supabase/server'
import { assertAdminOnly } from '@/lib/auth/assert-admin-only'
import AdminTopbar from '@/components/admin/AdminTopbar'
import { TrendingUp, Users, CheckCircle, Clock, MapPin, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatWesternInt } from '@/lib/format-western'

export const metadata = { title: 'التقارير والأداء — راف الوطنية' }

function normalizeSource(raw: string | null): string {
  const s = (raw ?? '').toLowerCase().trim()
  if (!s) return 'غير محدد'
  if (s.startsWith('snapchat'))  return 'Snapchat'
  if (s.startsWith('tiktok'))    return 'TikTok'
  if (s.startsWith('instagram')) return 'Instagram'
  if (s.startsWith('youtube'))   return 'YouTube'
  if (s.startsWith('facebook'))  return 'Facebook'
  return s.length > 16 ? s.slice(0, 15) + '…' : s
}

export default async function ReportsPage() {
  await assertAdminOnly()
  const supabase = await createClient()

  const [
    { count: total },
    { count: qualifiedCount },
    { count: unqualifiedCount },
    { count: pendingCount },
    { data: sourceRows },
    { data: cityRows },
    { data: salaryRows },
    { data: amountRows },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('qualification_status', 'qualified'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('qualification_status', 'unqualified'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('qualification_status', 'pending'),
    supabase.from('leads').select('visit_source_raw'),
    supabase.from('leads').select('city'),
    supabase.from('leads').select('salary_range_raw'),
    supabase.from('leads').select('requested_amount_raw'),
  ])

  const totalN = total ?? 0
  const qualN = qualifiedCount ?? 0
  const unqualN = unqualifiedCount ?? 0
  const pendN = pendingCount ?? 0
  const qualRate = totalN ? Math.round((qualN / totalN) * 100) : 0

  // Source breakdown
  const srcMap: Record<string, number> = {}
  for (const r of sourceRows ?? []) {
    const label = normalizeSource((r as { visit_source_raw: string | null }).visit_source_raw)
    srcMap[label] = (srcMap[label] ?? 0) + 1
  }
  const sourceData = Object.entries(srcMap).sort((a, b) => b[1] - a[1])

  // City breakdown
  const cityMap: Record<string, number> = {}
  for (const r of cityRows ?? []) {
    const c = ((r as { city: string | null }).city ?? '').trim() || 'غير محدد'
    cityMap[c] = (cityMap[c] ?? 0) + 1
  }
  const cityData = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 12)

  // Salary breakdown
  const salaryMap: Record<string, number> = {}
  for (const r of salaryRows ?? []) {
    const s = ((r as { salary_range_raw: string | null }).salary_range_raw ?? '').trim() || 'غير محدد'
    salaryMap[s] = (salaryMap[s] ?? 0) + 1
  }
  const salaryData = Object.entries(salaryMap).sort((a, b) => b[1] - a[1])

  // Amount breakdown
  const amtMap: Record<string, number> = {}
  for (const r of amountRows ?? []) {
    const a = ((r as { requested_amount_raw: string | null }).requested_amount_raw ?? '').trim() || 'غير محدد'
    amtMap[a] = (amtMap[a] ?? 0) + 1
  }
  const amountData = Object.entries(amtMap).sort((a, b) => b[1] - a[1])

  const barMax = (items: [string, number][]) => Math.max(...items.map(([, v]) => v), 1)

  return (
    <>
      <AdminTopbar title="التقارير والأداء" breadcrumb="التقارير" />
      <main className="flex-1 space-y-5 p-5 md:p-6" dir="rtl">

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: 'إجمالي العملاء', value: totalN, icon: Users, color: 'text-brand' },
            { label: 'مؤهَّلون', value: qualN, icon: CheckCircle, color: 'text-emerald-500' },
            { label: 'غير مؤهَّلين', value: unqualN, icon: TrendingUp, color: 'text-red-500' },
            { label: 'قيد التقييم', value: pendN, icon: Clock, color: 'text-amber-500' },
            { label: 'معدل التأهيل', value: `${qualRate}%`, icon: TrendingUp, color: 'text-blue-500' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <kpi.icon size={15} className={kpi.color} />
                <span className="text-[11px] font-medium text-gray-400">{kpi.label}</span>
              </div>
              <p className={cn('font-sans text-2xl font-bold tabular-nums', kpi.color)}>
                {typeof kpi.value === 'number' ? formatWesternInt(kpi.value) : kpi.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Source breakdown */}
          <ReportCard title="توزيع مصادر الزيارة" icon={Megaphone} items={sourceData} max={barMax(sourceData)} color="bg-brand" />

          {/* City breakdown */}
          <ReportCard title="توزيع المدن" icon={MapPin} items={cityData} max={barMax(cityData)} color="bg-blue-500" />

          {/* Salary breakdown */}
          <ReportCard title="توزيع شرائح الراتب" icon={TrendingUp} items={salaryData} max={barMax(salaryData)} color="bg-emerald-500" />

          {/* Requested amount */}
          <ReportCard title="المبالغ المطلوبة" icon={TrendingUp} items={amountData} max={barMax(amountData)} color="bg-purple-500" />
        </div>
      </main>
    </>
  )
}

function ReportCard({
  title,
  icon: Icon,
  items,
  max,
  color,
}: {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  items: [string, number][]
  max: number
  color: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-[0_2px_20px_-6px_rgba(14,26,51,0.10)] backdrop-blur-sm">
      <div className="relative border-b border-gray-100/80 px-5 py-4">
        <div className="absolute top-0 start-0 end-0 h-[1.5px] bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900">
            <Icon size={13} className="text-brand" />
          </div>
          <h3 className="text-navy-900 text-sm font-bold">{title}</h3>
          <span className="ms-auto font-sans text-[11px] text-gray-300">{items.length} فئة</span>
        </div>
      </div>
      <div className="divide-y divide-gray-50/80 px-5">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-300">لا توجد بيانات</p>
        ) : (
          items.map(([label, count]) => {
            const pct = Math.round((count / max) * 100)
            return (
              <div key={label} className="py-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-navy-900 max-w-[65%] truncate text-[12px] font-semibold">{label}</span>
                  <span className="font-sans text-[12px] font-bold text-gray-500 tabular-nums">
                    {formatWesternInt(count)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn('h-1.5 rounded-full transition-all', color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
