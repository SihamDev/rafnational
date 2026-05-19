import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Briefcase,
  CheckCircle2,
  Clock,
  MessageCircle,
  TrendingUp,
  Users,
  Zap,
  AlertCircle,
} from 'lucide-react'
import { getStaffUser } from '@/lib/supabase/server'
import AdminTopbar from '@/components/admin/AdminTopbar'
import { cn } from '@/lib/utils'
import {
  formatWesternInt,
  formatWesternLongDateAr,
  formatWesternShortDateTime,
} from '@/lib/format-western'
import { SALES_STATUS_LABELS, SALES_WORKFLOW_ORDER } from '@/types/leads'

type LeadItem = {
  id: string
  first_name: string | null
  family_name: string | null
  phone_number: string | null
  city: string | null
  qualification_status: string
  sales_workflow_status: string
  next_followup_at: string | null
  visit_source_raw: string | null
  created_at: string
}

function waHref(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  if (digits.startsWith('05') && digits.length === 10) return `https://wa.me/966${digits.slice(1)}`
  if (digits.startsWith('5') && digits.length === 9) return `https://wa.me/966${digits}`
  return `https://wa.me/${digits}`
}

function badgeSales(s: string) {
  const map: Record<string, string> = {
    new: 'bg-amber-100 text-amber-800',
    contacted: 'bg-blue-100 text-blue-800',
    follow_up: 'bg-indigo-100 text-indigo-800',
    no_answer: 'bg-gray-100 text-gray-700',
    interested: 'bg-purple-100 text-purple-800',
    not_interested: 'bg-rose-100 text-rose-600',
    converted: 'bg-emerald-100 text-emerald-800',
  }
  return cn(
    'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
    map[s] ?? 'bg-gray-100 text-gray-600'
  )
}

export default async function AgentDashboard() {
  const staff = await getStaffUser()
  if (!staff) notFound()

  const supabase = staff.supabase
  const userId = staff.user.id
  const isAgent = staff.role === 'sales_agent'

  const now = new Date().toISOString()
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const todayEndStr = todayEnd.toISOString()

  /* ── Stats ── */
  let q1 = supabase.from('leads').select('id', { count: 'exact', head: true })
  let q2 = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('sales_workflow_status', 'new')
  let q3 = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .gte('next_followup_at', now)
    .lte('next_followup_at', todayEndStr)
  let q4 = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .not('next_followup_at', 'is', null)
    .lt('next_followup_at', now)
  let q5 = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('sales_workflow_status', 'converted')
  let q6 = supabase
    .from('leads')
    .select(
      'id,first_name,family_name,phone_number,city,qualification_status,sales_workflow_status,next_followup_at,visit_source_raw,created_at'
    )
    .not('next_followup_at', 'is', null)
    .lte('next_followup_at', todayEndStr)
    .order('next_followup_at', { ascending: true })
    .limit(20)
  let q7 = supabase.from('leads').select('sales_workflow_status')

  if (isAgent) {
    q1 = q1.eq('assigned_to', userId)
    q2 = q2.eq('assigned_to', userId)
    q3 = q3.eq('assigned_to', userId)
    q4 = q4.eq('assigned_to', userId)
    q5 = q5.eq('assigned_to', userId)
    q6 = q6.eq('assigned_to', userId)
    q7 = q7.eq('assigned_to', userId)
  }

  const [
    { count: totalAssigned },
    { count: newLeads },
    { count: dueToday },
    { count: overdue },
    { count: converted },
    { data: dueSoonRaw },
    { data: allLeadsRaw },
  ] = await Promise.all([q1, q2, q3, q4, q5, q6, q7])

  const dueLeads = (dueSoonRaw ?? []) as LeadItem[]

  /* ── Pipeline counts ── */
  const pipeMap: Record<string, number> = {}
  for (const r of allLeadsRaw ?? []) {
    const s = (r as { sales_workflow_status: string }).sales_workflow_status ?? 'new'
    pipeMap[s] = (pipeMap[s] ?? 0) + 1
  }
  const pipeMax = Math.max(...Object.values(pipeMap), 1)

  const PIPE_COLORS: Record<string, string> = {
    new: 'bg-amber-400',
    contacted: 'bg-blue-400',
    follow_up: 'bg-indigo-400',
    no_answer: 'bg-gray-400',
    interested: 'bg-purple-400',
    not_interested: 'bg-rose-400',
    converted: 'bg-emerald-500',
  }

  return (
    <>
      <AdminTopbar title={isAgent ? 'مساحتي' : 'لوحة المندوب'} breadcrumb="المبيعات" />

      <main className="flex-1 space-y-5 p-5 md:p-6" dir="rtl">
        {/* ── Greeting banner ── */}
        <div className="bg-ink relative overflow-hidden rounded-2xl px-6 py-5 text-white">
          <div className="bg-brand/10 pointer-events-none absolute -top-10 right-8 h-40 w-40 rounded-full blur-[60px]" />
          <p className="text-brand/60 text-[10px] font-bold tracking-[0.25em] uppercase">
            {isAgent ? 'مساحة المندوب' : 'عرض مندوب'}
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {isAgent ? 'أهلاً، ما يلزم يلزم 👊' : 'لوحة المندوب'}
          </h2>
          <p className="mt-1 text-sm text-white/40">{formatWesternLongDateAr()}</p>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {(
            [
              {
                label: 'إجمالي المسندة',
                value: totalAssigned ?? 0,
                icon: Briefcase,
                cls: 'bg-white',
                href: '/admin/leads',
              },
              {
                label: 'جدد لم يُتصل بهم',
                value: newLeads ?? 0,
                icon: Zap,
                cls: 'bg-amber-50',
                href: '/admin/leads?sales=new',
              },
              {
                label: 'متابعة اليوم',
                value: dueToday ?? 0,
                icon: Clock,
                cls: 'bg-blue-50',
                href: '#due',
              },
              {
                label: 'متأخرة',
                value: overdue ?? 0,
                icon: AlertCircle,
                cls: overdue ? 'bg-rose-50' : 'bg-white',
                href: '#due',
              },
              {
                label: 'تحويلات',
                value: converted ?? 0,
                icon: CheckCircle2,
                cls: 'bg-emerald-50',
                href: '/admin/leads?sales=converted',
              },
            ] as const
          ).map((kpi) => {
            const Icon = kpi.icon
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className={cn(
                  'flex flex-col gap-1.5 rounded-2xl border border-black/[0.06] px-4 py-4 shadow-sm transition-shadow hover:shadow-md',
                  kpi.cls
                )}
              >
                <Icon size={16} className="text-gray-400" />
                <p className="text-ink text-2xl font-black tabular-nums">
                  {formatWesternInt(kpi.value)}
                </p>
                <p className="text-[11px] font-semibold text-gray-400">{kpi.label}</p>
              </Link>
            )
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* ── Due & overdue leads ── */}
          <div
            id="due"
            className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-sm lg:col-span-3"
          >
            <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-brand" />
                <span className="text-ink text-sm font-bold">مواعيد المتابعة</span>
              </div>
              <Link
                href="/admin/leads"
                className="text-brand text-[11px] font-semibold hover:underline"
              >
                عرض الكل
              </Link>
            </div>

            {dueLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <CheckCircle2 size={28} className="mb-3 text-emerald-300" />
                <p className="text-sm font-semibold text-gray-400">لا توجد متابعات معلقة لليوم</p>
                <p className="mt-1 text-xs text-gray-300">أنجزت كل المهام! 🎉</p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.04]">
                {dueLeads.map((lead) => {
                  const isOverdue = lead.next_followup_at != null && lead.next_followup_at < now
                  const name = `${lead.first_name ?? ''} ${lead.family_name ?? ''}`.trim()
                  const wa = waHref(lead.phone_number)
                  const dueDate = lead.next_followup_at
                    ? formatWesternShortDateTime(lead.next_followup_at)
                    : null
                  return (
                    <div
                      key={lead.id}
                      className={cn(
                        'flex items-center gap-3 px-5 py-3.5',
                        isOverdue && 'bg-rose-50/50'
                      )}
                    >
                      <div
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          isOverdue ? 'bg-rose-500' : 'bg-amber-400'
                        )}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href="/admin/leads"
                            className="text-ink hover:text-brand truncate text-[13px] font-semibold"
                          >
                            {name || '—'}
                          </Link>
                          <span className={badgeSales(lead.sales_workflow_status)}>
                            {SALES_STATUS_LABELS[
                              lead.sales_workflow_status as keyof typeof SALES_STATUS_LABELS
                            ] ?? lead.sales_workflow_status}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-400">
                          {lead.city && <span>{lead.city}</span>}
                          {dueDate && (
                            <span
                              className={cn(
                                'font-mono',
                                isOverdue && 'font-semibold text-rose-500'
                              )}
                            >
                              {isOverdue ? '⚠ متأخر — ' : ''}
                              {dueDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <MessageCircle size={12} />
                          واتساب
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Pipeline ── */}
          <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2 border-b border-black/[0.05] px-5 py-4">
              <TrendingUp size={15} className="text-brand" />
              <span className="text-ink text-sm font-bold">مسار العملاء</span>
            </div>
            <div className="space-y-3 p-5">
              {SALES_WORKFLOW_ORDER.map((key) => {
                const count = pipeMap[key] ?? 0
                const pct = pipeMax > 0 ? Math.round((count / pipeMax) * 100) : 0
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-ink text-[12px] font-semibold">
                        {SALES_STATUS_LABELS[key]}
                      </span>
                      <span className="font-mono text-[12px] font-bold text-gray-500">
                        {formatWesternInt(count)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-500',
                          PIPE_COLORS[key] ?? 'bg-gray-400'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-2 border-t border-black/[0.05] px-5 py-3">
              <Link
                href="/admin/leads?sales=new"
                className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <Zap size={11} />
                اتصل بالجدد
              </Link>
              <Link
                href="/admin/leads?sales=follow_up"
                className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <Users size={11} />
                متابعة مجدولة
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
