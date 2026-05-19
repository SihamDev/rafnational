import { redirect, notFound } from 'next/navigation'
import { getStaffUser } from '@/lib/supabase/server'
import { Users, Clock, CheckCircle, TrendingUp, ArrowLeft, Zap, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import AdminTopbar from '@/components/admin/AdminTopbar'
import StatCard from '@/components/admin/StatCard'
import ChartCard from '@/components/admin/ChartCard'
import { cn } from '@/lib/utils'
import { formatWesternInt, formatWesternShortDateTime } from '@/lib/format-western'
import type { LineChartProps } from '@/components/charts/LineChart'
import type { BarChartProps } from '@/components/charts/BarChart'
import type { PieChartProps } from '@/components/charts/PieChart'

// Cache dashboard stats for 60 seconds — reduces DB load significantly
export const revalidate = 60

const LineChart = dynamic<LineChartProps>(() => import('@/components/charts/LineChart'))
const BarChart = dynamic<BarChartProps>(() => import('@/components/charts/BarChart'))
const PieChart = dynamic<PieChartProps>(() => import('@/components/charts/PieChart'))

/* ── Types ─────────────────────────────────────────────────────────── */
type RecentLead = {
  id: string
  first_name: string | null
  family_name: string | null
  phone_number: string | null
  city: string | null
  qualification_status: string
  visit_source_raw: string | null
  created_at: string
}

/* ── Funnel stage config ───────────────────────────────────────────── */
const FUNNEL_STAGES = [
  { key: 'new', label: 'جديد', color: 'bg-amber-400', text: 'text-amber-700' },
  { key: 'contacted', label: 'تم التواصل', color: 'bg-blue-400', text: 'text-blue-700' },
  { key: 'follow_up', label: 'متابعة', color: 'bg-indigo-400', text: 'text-indigo-700' },
  { key: 'no_answer', label: 'لا يجيب', color: 'bg-gray-400', text: 'text-gray-600' },
  { key: 'interested', label: 'مهتم', color: 'bg-purple-400', text: 'text-purple-700' },
  { key: 'not_interested', label: 'غير مهتم', color: 'bg-rose-400', text: 'text-rose-700' },
  { key: 'converted', label: 'تحويل ناجح', color: 'bg-grass', text: 'text-grass-dark' },
] as const

/* ── Qual status styles ─────────────────────────────────────────────── */
const QUAL_CLS: Record<string, { badge: string; dot: string }> = {
  pending: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  qualified: { badge: 'bg-grass/10 text-grass-dark', dot: 'bg-grass' },
  unqualified: { badge: 'bg-red-100 text-red-600', dot: 'bg-red-400' },
}
const QUAL_LABELS: Record<string, string> = {
  pending: 'قيد التقييم',
  qualified: 'مؤهَّل',
  unqualified: 'غير مؤهل',
}

/* ── Source normaliser — kept for recent-leads display ──────────────────── */
function normalizeSource(raw: string | null): string {
  const s = (raw ?? '').toLowerCase().trim()
  if (!s) return 'غير محدد'
  if (s.startsWith('snapchat')) return 'Snapchat'
  if (s.startsWith('tiktok')) return 'TikTok'
  if (s.startsWith('instagram')) return 'Instagram'
  if (s.startsWith('youtube')) return 'YouTube'
  if (s.startsWith('facebook')) return 'Facebook'
  return s.length > 14 ? s.slice(0, 13) + '…' : s
}

/* ══════════════════════════════════════════════════════════════════════
   Page component
══════════════════════════════════════════════════════════════════════ */
export default async function AdminDashboard() {
  const staff = await getStaffUser()
  if (!staff) notFound()
  if (staff.role === 'sales_agent') redirect('/admin/agent')
  if (staff.role !== 'admin') notFound()
  const supabase = staff.supabase

  /* ── Single RPC call — replaces 9 individual queries ── */
  const { data: rpc } = await supabase.rpc('crm_admin_dashboard')

  type DashStats = {
    total: number
    today_count: number
    qualified: number
    pending: number
    unqualified: number
    by_sales: Record<string, number>
    by_source: { label: string; value: number }[]
    by_city: { label: string; value: number }[]
    trend_30d: { label: string; approved: number; rejected: number }[]
    recent_leads: RecentLead[]
  }
  const stats = (rpc ?? {}) as DashStats

  const totalN = stats.total ?? 0
  const qualN = stats.qualified ?? 0
  const pendingN = stats.pending ?? 0
  const todayN = stats.today_count ?? 0

  const wfMap = stats.by_sales ?? {}
  const sourceData = stats.by_source ?? []
  const cityData = stats.by_city ?? []
  const trendData = stats.trend_30d ?? []
  const recentLeads = (stats.recent_leads ?? []) as RecentLead[]

  const funnelMax = Math.max(...FUNNEL_STAGES.map((s) => wfMap[s.key] ?? 0), 1)
  const qualRate = totalN ? Math.round((qualN / totalN) * 100) : 0

  /* ════════════════════════════════════════════════════════════════════
     JSX
  ════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <AdminTopbar title="لوحة التحكم" />

      <main className="flex-1 space-y-5 p-5 md:p-6" dir="rtl">
        {/* ══ Hero ═══════════════════════════════════════════════════════ */}
        <div className="funnel-hero-banner px-6 py-7 md:px-8 md:py-8">
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="funnel-eyebrow mb-4">
                <span className="bg-grass h-1.5 w-1.5 rounded-full" />
                راف الوطنية · التمويل العقاري
              </p>
              <h2 className="font-heading text-ink text-2xl leading-tight font-bold md:text-3xl">
                مرحباً بك في مركز العمليات
              </h2>
              <p className="text-ink/70 mt-2 text-sm">
                متابعة مباشرة لأداء الفريق · تقييم العملاء · مسار التحويل
              </p>
            </div>

            {/* Hero KPIs */}
            <div className="flex flex-wrap gap-2.5">
              {[
                { label: 'إجمالي العملاء', value: formatWesternInt(totalN), color: 'text-ink' },
                { label: 'مؤهَّلون', value: formatWesternInt(qualN), color: 'text-grass-dark' },
                { label: 'معدل التأهيل', value: `${qualRate}%`, color: 'text-ink' },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="shadow-soft rounded-2xl border border-black/[0.06] bg-white/90 px-4 py-3 text-center backdrop-blur-sm"
                >
                  <p className={`font-sans text-xl font-bold tabular-nums ${kpi.color}`}>
                    {kpi.value}
                  </p>
                  <p className="text-muted-funnel mt-0.5 text-[10px] font-medium">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ Stat cards ══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="إجمالي العملاء"
            value={formatWesternInt(totalN)}
            icon={Users}
            tone="base"
            href="/admin/leads"
          />
          <StatCard
            label="جدد اليوم"
            value={todayN}
            icon={Zap}
            tone="info"
            href="/admin/leads?sales=new"
          />
          <StatCard
            label="قيد التقييم"
            value={formatWesternInt(pendingN)}
            icon={Clock}
            tone="pending"
            href="/admin/leads?qualification=pending"
          />
          <StatCard
            label="معدل التأهيل"
            value={`${qualRate}%`}
            icon={CheckCircle}
            tone="approved"
          />
        </div>

        {/* ══ Charts row ══════════════════════════════════════════════════ */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartCard title="تدفق العملاء — آخر 30 يوم" subtitle="مؤهَّل · غير مؤهل">
              <LineChart data={trendData} />
            </ChartCard>
          </div>
          <ChartCard title="مصادر الزيارة" subtitle="توزيع قنوات الإعلان">
            <PieChart data={sourceData} centerLabel="عميل" overrideTotal={totalN} />
          </ChartCard>
        </div>

        {/* ══ City bar chart ══════════════════════════════════════════════ */}
        <ChartCard title="توزيع العملاء حسب المدينة" subtitle="أعلى 8 مدن — إجمالي الطلبات">
          <BarChart data={cityData} color="#F4C430" />
        </ChartCard>

        {/* ══ Bottom row: Funnel + Recent ══════════════════════════════════ */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Sales funnel pipeline ── */}
          <div className="crm-card">
            <div className="crm-card-header">
              <div className="flex items-center gap-2.5">
                <div className="bg-honey-pale flex h-7 w-7 items-center justify-center rounded-lg">
                  <TrendingUp size={13} className="text-gold" />
                </div>
                <h3 className="font-heading text-ink text-sm font-bold">مسار المبيعات</h3>
              </div>
              <Link
                href="/admin/leads"
                className="text-grass-dark hover:bg-grass/10 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors"
              >
                فتح CRM <ArrowLeft size={11} />
              </Link>
            </div>

            <div className="space-y-2.5 p-5">
              {FUNNEL_STAGES.map((stage) => {
                const count = wfMap[stage.key] ?? 0
                const pct = funnelMax > 0 ? Math.round((count / funnelMax) * 100) : 0
                return (
                  <div key={stage.key}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', stage.color)} />
                        <span className="text-ink text-[12px] font-semibold">{stage.label}</span>
                      </div>
                      <span
                        className={cn('font-sans text-[12px] font-bold tabular-nums', stage.text)}
                      >
                        {formatWesternInt(count)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-500',
                          stage.color
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              {/* Converted highlight */}
              {(wfMap.converted ?? 0) > 0 && (
                <div className="border-grass/25 bg-grass/10 mt-4 flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-grass h-2 w-2 rounded-full" />
                    <span className="text-grass-dark text-sm font-bold">إجمالي التحويلات</span>
                  </div>
                  <span className="text-grass-dark font-sans text-lg font-bold tabular-nums">
                    {formatWesternInt(wfMap.converted ?? 0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Recent leads ── */}
          <div className="crm-card">
            <div className="crm-card-header">
              <div className="flex items-center gap-2.5">
                <div className="bg-honey-pale flex h-7 w-7 items-center justify-center rounded-lg">
                  <Clock size={13} className="text-gold" />
                </div>
                <h3 className="font-heading text-ink text-sm font-bold">أحدث العملاء</h3>
              </div>
              <Link
                href="/admin/leads"
                className="text-grass-dark hover:bg-grass/10 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors"
              >
                عرض الكل <ArrowLeft size={11} />
              </Link>
            </div>

            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users size={28} className="mb-3 text-gray-200" />
                <p className="text-sm text-gray-300">لا يوجد عملاء بعد</p>
                <p className="mt-1 text-[11px] text-gray-200">
                  ستظهر بيانات العملاء هنا بعد أول تقديم
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50/80">
                {recentLeads.map((lead) => {
                  const q = lead.qualification_status ?? 'pending'
                  const cls = QUAL_CLS[q] ?? QUAL_CLS.pending
                  const src = normalizeSource(lead.visit_source_raw)
                  const name = [lead.first_name, lead.family_name].filter(Boolean).join(' ') || '—'
                  const date = formatWesternShortDateTime(lead.created_at)
                  return (
                    <Link
                      key={lead.id}
                      href={`/admin/leads`}
                      className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-gray-50/70"
                    >
                      {/* Avatar */}
                      <div className="bg-honey-pale font-heading text-gold ring-gold/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm ring-1">
                        {(lead.first_name ?? '?')[0]}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-ink truncate text-[13px] font-semibold">{name}</p>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                              cls.badge
                            )}
                          >
                            {QUAL_LABELS[q]}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
                          {lead.city && (
                            <span className="flex items-center gap-0.5">
                              <MapPin size={9} />
                              {lead.city}
                            </span>
                          )}
                          {lead.phone_number && (
                            <span className="flex items-center gap-0.5">
                              <Phone size={9} />
                              {lead.phone_number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-end">
                        <p className="font-sans text-[10px] font-semibold text-gray-400">{src}</p>
                        <p className="mt-0.5 font-sans text-[10px] text-gray-300">{date}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
