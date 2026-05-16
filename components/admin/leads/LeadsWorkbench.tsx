'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  MessageCircle,
  Search,
  Trash2,
  UsersRound,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminUpdateLead, agentUpdateLead, quickQualifyLead, deleteLead } from '@/lib/actions/leads'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  formatWesternDateOnly,
  formatWesternDateTime,
  formatWesternInt,
} from '@/lib/format-western'
import type { StaffRole } from '@/types/leads'
import {
  QUALIFICATION_LABELS,
  QUALIFICATION_ORDER,
  SALES_STATUS_LABELS,
  SALES_WORKFLOW_ORDER,
  type LeadRow,
  type QualificationStatus,
  type SalesWorkflowStatus,
} from '@/types/leads'

/* ── Textarea style ── */
const textareaCls =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 min-h-[120px] w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 md:text-sm'

const filterSelectCls =
  'h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring rtl:text-right'

/* ── Badge helpers ── */
function badgeQual(q: QualificationStatus) {
  const cls =
    q === 'qualified'
      ? 'bg-emerald-100 text-emerald-800 ring-emerald-500/25'
      : q === 'unqualified'
        ? 'bg-rose-100 text-rose-800 ring-rose-400/40'
        : 'bg-amber-100 text-amber-900 ring-amber-500/35'
  return cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', cls)
}

/* ── URL builder ── */
function buildHref(parts: Record<string, string>) {
  const filtered = Object.fromEntries(Object.entries(parts).filter(([, v]) => v !== '' && v !== '__all'))
  return `/admin/leads?${new URLSearchParams(filtered).toString()}`
}

/* ── Yes/No helper ── */
function yn(v: boolean | null | undefined) {
  if (v === true) return 'نعم'
  if (v === false) return 'لا'
  return '—'
}

/* ── Detail field in popup ── */
function D({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  const v = (value ?? '').trim()
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold text-gray-400 tracking-wide">{label}</dt>
      <dd className={cn('text-[13px] font-medium text-gray-800 break-words', mono && 'font-mono text-[12px]')}>
        {v === '' ? <span className="text-gray-300">—</span> : v}
      </dd>
    </div>
  )
}

/* ── Phone helpers ── */
function normalizeWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  // Saudi numbers: 05xxxxxxxx → 9665xxxxxxxx
  if (digits.startsWith('05') && digits.length === 10) return `966${digits.slice(1)}`
  if (digits.startsWith('5') && digits.length === 9)  return `966${digits}`
  if (digits.startsWith('00')) return digits.slice(2)
  return digits
}

function waHref(phone: string | null | undefined) {
  const n = normalizeWhatsApp(phone)
  return n ? `https://wa.me/${n}` : null
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('تم النسخ'),
    () => toast.error('فشل النسخ'),
  )
}

/* ── Export rows to CSV ── */
function exportCsv(rows: LeadRow[]) {
  const headers = [
    'الاسم الأول', 'اسم العائلة', 'الجوال', 'البريد', 'المدينة',
    'الراتب', 'البنك', 'جهة العمل', 'المبلغ المطلوب',
    'تمويل قائم', 'إيقاف خدمات', 'دعم سكني', 'مصدر الزيارة',
    'التأهيل', 'مرحلة المبيعات', 'تاريخ الإرسال',
  ]
  const toRow = (l: LeadRow) => [
    l.first_name ?? '',
    l.family_name ?? '',
    l.phone_number ?? l.phone_normalized ?? '',
    l.email ?? '',
    l.city ?? '',
    l.salary_range_raw ?? '',
    l.bank_name ?? '',
    l.employer_raw ?? '',
    l.requested_amount_raw ?? '',
    yn(l.has_existing_mortgage),
    yn(l.has_service_hold),
    l.housing_support_raw ?? '',
    l.visit_source_raw ?? '',
    QUALIFICATION_LABELS[l.qualification_status],
    SALES_STATUS_LABELS[l.sales_workflow_status],
    l.funnel_submitted_at ?? l.created_at,
  ]

  const csvContent =
    '\uFEFF' + // BOM for Excel Arabic support
    [headers, ...rows.map(toRow)]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ══════════════════════════════════════════════════════════
   Props
══════════════════════════════════════════════════════════ */
type DashboardPayload = {
  total: number
  in_window: number
  by_qualification?: Record<string, number>
  by_sales?: Record<string, number>
  by_source?: { label: string; value: number }[]
} | null

export interface LeadsWorkbenchProps {
  staffRole: StaffRole
  rows: LeadRow[]
  agents: { id: string; full_name: string | null }[]
  assigneeLookup?: Record<string, string | null>
  stats: DashboardPayload
  total: number
  page: number
  pageSize: number
  query: string
  qualificationFilter: string
  salesFilter: string
  sort: string
  dir: 'asc' | 'desc'
}

/* ══════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════ */
export default function LeadsWorkbench({
  staffRole,
  rows,
  agents,
  stats,
  total,
  page,
  pageSize,
  query,
  qualificationFilter,
  salesFilter,
  sort,
  dir,
}: LeadsWorkbenchProps) {
  const router = useRouter()
  const [pending, start] = useTransition()

  /* ── Client-only flag — prevents SSR/hydration mismatch on sort icons ── */
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  /* ── Detail dialog ── */
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<LeadRow | null>(null)
  const [qual, setQual] = useState<QualificationStatus>('pending')
  const [salesStat, setSalesStat] = useState<SalesWorkflowStatus>('new')
  const [assign, setAssign] = useState('')
  const [notes, setNotes] = useState('')
  const [followupAt, setFollowupAt] = useState<string>('')

  /* ── Inline actions ── */
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<LeadRow | null>(null)

  /* ── Debounced search ── */
  const [searchInput, setSearchInput] = useState(query)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams()
      if (value) params.set('q', value)
      if (qualificationFilter && qualificationFilter !== '__all') params.set('qualification', qualificationFilter)
      if (salesFilter && salesFilter !== '__all') params.set('sales', salesFilter)
      if (sort !== 'created_at') params.set('sort', sort)
      if (dir !== 'desc') params.set('dir', dir)
      router.replace(`/admin/leads?${params.toString()}`)
    },
    [qualificationFilter, salesFilter, sort, dir, router],
  )

  useEffect(() => {
    if (searchInput === query) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => pushSearch(searchInput), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput, query, pushSearch])

  /* ── Realtime — new lead notification ── */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
        toast('عميل جديد وصل للتو', {
          description: 'تم استقبال طلب جديد من الفورم',
          action: { label: 'تحديث', onClick: () => router.refresh() },
          duration: 8000,
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  /* ── Sort helpers ── */
  function sortHref(col: string) {
    const newDir = sort === col ? (dir === 'asc' ? 'desc' : 'asc') : 'desc'
    return buildHref({ q: query, qualification: qualificationFilter, sales: salesFilter, sort: col, dir: newDir, page: '1' })
  }

  function SortIcon({ col }: { col: string }) {
    if (sort !== col) return <ArrowUpDown size={11} className="opacity-30 ms-1 inline-block" />
    return dir === 'asc'
      ? <ArrowUp size={11} className="text-brand ms-1 inline-block" />
      : <ArrowDown size={11} className="text-brand ms-1 inline-block" />
  }

  /* ── Open lead detail ── */
  function openLead(l: LeadRow) {
    setActive(l)
    setQual(l.qualification_status)
    setSalesStat(l.sales_workflow_status)
    setAssign(l.assigned_to ?? '')
    setNotes(l.internal_notes ?? '')
    setFollowupAt(l.next_followup_at ? new Date(l.next_followup_at).toISOString().slice(0, 16) : '')
    setOpen(true)
  }

  /* ── Persist dialog changes ── */
  async function persist() {
    if (!active) return
    start(async () => {
      if (staffRole === 'admin') {
        const res = await adminUpdateLead(active.id, {
          qualification_status: qual,
          sales_workflow_status: salesStat,
          assigned_to: assign === '' || assign === '__unassigned' ? null : assign,
          internal_notes: notes || null,
          next_followup_at: followupAt ? new Date(followupAt).toISOString() : null,
        })
        if (res?.error) toast.error(res.error)
        else { toast.success('تم تحديث العميل'); router.refresh(); setOpen(false) }
      } else {
        const res = await agentUpdateLead(active.id, {
          sales_workflow_status: salesStat,
          internal_notes: notes || null,
          next_followup_at: followupAt ? new Date(followupAt).toISOString() : null,
        })
        if (res?.error) toast.error(res.error)
        else { toast.success('تم حفظ الملاحظات'); router.refresh(); setOpen(false) }
      }
    })
  }

  function handleQuickQualify(lead: LeadRow, status: 'qualified' | 'unqualified') {
    setActionPending(lead.id + status)
    start(async () => {
      const res = await quickQualifyLead(lead.id, status)
      setActionPending(null)
      if (res?.error) toast.error(res.error)
      else { toast.success(status === 'qualified' ? 'تم قبول العميل ✓' : 'تم رفض العميل'); router.refresh() }
    })
  }

  function handleDelete(lead: LeadRow) {
    setActionPending(lead.id + 'del')
    start(async () => {
      const res = await deleteLead(lead.id)
      setActionPending(null)
      setDeleteConfirm(null)
      if (res?.error) toast.error(res.error)
      else { toast.success('تم حذف العميل'); router.refresh() }
    })
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo = (page - 1) * pageSize + rows.length
  const byQ = stats?.by_qualification ?? {}

  /* ══════════════════════════════
     Render
  ══════════════════════════════ */
  return (
    <div className="p-5 md:p-6 space-y-4" dir="rtl">

      {/* ── Stat pills (clickable filters) ── */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'الكل',        value: stats?.total ?? total,  cls: 'bg-gray-100 text-gray-700 hover:bg-gray-200',          href: buildHref({ q: query, sales: salesFilter }) },
          { label: 'قيد التقييم', value: byQ.pending ?? '—',     cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200',       href: buildHref({ q: query, qualification: 'pending', sales: salesFilter }) },
          { label: 'مؤهَّل',      value: byQ.qualified ?? '—',   cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', href: buildHref({ q: query, qualification: 'qualified', sales: salesFilter }) },
          { label: 'غير مؤهَّل', value: byQ.unqualified ?? '—', cls: 'bg-rose-100 text-rose-700 hover:bg-rose-200',          href: buildHref({ q: query, qualification: 'unqualified', sales: salesFilter }) },
        ].map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${s.cls}`}
          >
            <span>{s.label}</span>
            <span className="font-black tabular-nums">
              {typeof s.value === 'number' ? formatWesternInt(s.value) : s.value}
            </span>
          </Link>
        ))}
      </div>

      {/* ── Table card ── */}
      <div className="rounded-2xl border border-black/[0.07] bg-white shadow-sm overflow-hidden">

        {/* Filter / toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.05] px-5 py-3">
          <UsersRound size={15} className="text-brand shrink-0" />
          <span className="text-sm font-bold text-navy-900 me-1">{formatWesternInt(total)} عميل</span>

          {/* Live search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-2.5 text-gray-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="بحث باسم أو جوال..."
              className="ps-8 h-8 text-sm"
            />
          </div>

          {/* Qualification filter */}
          <select
            value={qualificationFilter || '__all'}
            onChange={(e) => router.replace(buildHref({ q: searchInput, qualification: e.target.value, sales: salesFilter, sort, dir, page: '1' }))}
            className={filterSelectCls}
          >
            <option value="__all">كل الحالات</option>
            {QUALIFICATION_ORDER.map((k) => (
              <option key={k} value={k}>{QUALIFICATION_LABELS[k]}</option>
            ))}
          </select>

          {/* Sales filter */}
          <select
            value={salesFilter || '__all'}
            onChange={(e) => router.replace(buildHref({ q: searchInput, qualification: qualificationFilter, sales: e.target.value, sort, dir, page: '1' }))}
            className={filterSelectCls}
          >
            <option value="__all">كل المراحل</option>
            {SALES_WORKFLOW_ORDER.map((k) => (
              <option key={k} value={k}>{SALES_STATUS_LABELS[k]}</option>
            ))}
          </select>

          {/* Clear */}
          {(searchInput || qualificationFilter !== '__all' || salesFilter !== '__all') && (
            <button
              onClick={() => { setSearchInput(''); router.replace('/admin/leads') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline whitespace-nowrap"
            >
              مسح الكل
            </button>
          )}

          {/* Export */}
          <button
            onClick={() => exportCsv(rows)}
            disabled={rows.length === 0}
            title="تصدير CSV"
            className="ms-auto flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <Download size={13} />
            تصدير
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-right text-[13px]">
            <thead className="bg-gray-50/80 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-b border-black/[0.05]">
              <tr>
                <th className="px-5 py-3">
                  <Link href={sortHref('first_name')} className="flex items-center gap-0.5 hover:text-gray-600">
                    العميل <SortIcon col="first_name" />
                  </Link>
                </th>
                <th className="px-5 py-3">الجوال</th>
                <th className="px-5 py-3">
                  <Link href={sortHref('city')} className="flex items-center gap-0.5 hover:text-gray-600">
                    المدينة <SortIcon col="city" />
                  </Link>
                </th>
                <th className="px-5 py-3">
                  <Link href={sortHref('created_at')} className="flex items-center gap-0.5 hover:text-gray-600">
                    التاريخ <SortIcon col="created_at" />
                  </Link>
                </th>
                <th className="px-5 py-3">
                  <Link href={sortHref('qualification_status')} className="flex items-center gap-0.5 hover:text-gray-600">
                    الحالة <SortIcon col="qualification_status" />
                  </Link>
                </th>
                {staffRole === 'admin' && (
                  <th className="px-5 py-3 text-center">الإجراءات</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {rows.map((lead) => {
                const isActing = actionPending?.startsWith(lead.id)
                const name = `${lead.first_name ?? ''} ${lead.family_name ?? ''}`.trim()
                const date = lead.funnel_submitted_at ?? lead.created_at
                return (
                  <tr
                    key={lead.id}
                    onClick={() => openLead(lead)}
                    className={cn(
                      'cursor-pointer transition-colors group',
                      lead.next_followup_at && lead.next_followup_at < new Date().toISOString()
                        ? 'bg-amber-50/60 hover:bg-amber-50'
                        : lead.qualification_status === 'qualified'
                          ? 'bg-emerald-50/50 hover:bg-emerald-50'
                          : lead.qualification_status === 'unqualified'
                            ? 'bg-rose-50/40 hover:bg-rose-50/80'
                            : 'bg-white hover:bg-gray-50',
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-navy-900 group-hover:text-brand transition-colors leading-tight flex items-center gap-1.5">
                        {name || '—'}
                        {lead.next_followup_at && lead.next_followup_at < new Date().toISOString() && (
                          <span title="متابعة متأخرة" className="shrink-0 text-amber-500">
                            <Clock size={11} />
                          </span>
                        )}
                      </p>
                      {lead.visit_source_raw && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{lead.visit_source_raw}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-gray-600" dir="ltr" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span>{lead.phone_number ?? lead.phone_normalized ?? '—'}</span>
                        {(lead.phone_number ?? lead.phone_normalized) && (<>
                          <button
                            onClick={() => copyToClipboard(lead.phone_number ?? lead.phone_normalized ?? '')}
                            title="نسخ"
                            className="text-gray-300 hover:text-gray-600 transition-colors"
                          >
                            <Copy size={11} />
                          </button>
                          {waHref(lead.phone_number ?? lead.phone_normalized) && (
                            <a
                              href={waHref(lead.phone_number ?? lead.phone_normalized)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="واتساب"
                              className="text-gray-300 hover:text-emerald-500 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle size={12} />
                            </a>
                          )}
                        </>)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {lead.city ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                      {date ? formatWesternDateOnly(date) : '—'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={badgeQual(lead.qualification_status)}>
                        {QUALIFICATION_LABELS[lead.qualification_status]}
                      </span>
                    </td>
                    {staffRole === 'admin' && (
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={isActing || lead.qualification_status === 'qualified'}
                            onClick={() => handleQuickQualify(lead, 'qualified')}
                            title="قبول"
                            className={cn(
                              'rounded-lg p-1.5 transition-all',
                              lead.qualification_status === 'qualified'
                                ? 'text-emerald-400 cursor-default'
                                : 'text-gray-300 hover:bg-emerald-50 hover:text-emerald-600 active:scale-95',
                              isActing && 'opacity-40 pointer-events-none',
                            )}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            type="button"
                            disabled={isActing || lead.qualification_status === 'unqualified'}
                            onClick={() => handleQuickQualify(lead, 'unqualified')}
                            title="رفض"
                            className={cn(
                              'rounded-lg p-1.5 transition-all',
                              lead.qualification_status === 'unqualified'
                                ? 'text-rose-400 cursor-default'
                                : 'text-gray-300 hover:bg-rose-50 hover:text-rose-500 active:scale-95',
                              isActing && 'opacity-40 pointer-events-none',
                            )}
                          >
                            <XCircle size={18} />
                          </button>
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => setDeleteConfirm(lead)}
                            title="حذف"
                            className={cn(
                              'rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95',
                              isActing && 'opacity-40 pointer-events-none',
                            )}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-gray-400">
                    لا توجد نتائج — جرّب تغيير الفلتر أو مسح البحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-black/[0.05]">
          {rows.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">لا توجد نتائج.</p>
          )}
          {rows.map((lead) => {
            const isActing = actionPending?.startsWith(lead.id)
            const name = `${lead.first_name ?? ''} ${lead.family_name ?? ''}`.trim()
            return (
              <div
                key={lead.id}
                onClick={() => openLead(lead)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors',
                  lead.qualification_status === 'qualified'
                    ? 'bg-emerald-50/50 hover:bg-emerald-50'
                    : lead.qualification_status === 'unqualified'
                      ? 'bg-rose-50/40'
                      : 'bg-white hover:bg-gray-50',
                )}
              >
                {/* Avatar initial */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 font-bold text-brand text-sm">
                  {(lead.first_name ?? '؟')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy-900 truncate">{name || '—'}</p>
                  <p className="text-[12px] text-gray-400 font-mono mt-0.5" dir="ltr">
                    {lead.phone_number ?? lead.phone_normalized ?? '—'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={badgeQual(lead.qualification_status)}>
                    {QUALIFICATION_LABELS[lead.qualification_status]}
                  </span>
                  {staffRole === 'admin' && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        disabled={isActing || lead.qualification_status === 'qualified'}
                        onClick={() => handleQuickQualify(lead, 'qualified')}
                        className={cn('rounded p-1 transition-all', lead.qualification_status === 'qualified' ? 'text-emerald-400' : 'text-gray-300 hover:text-emerald-600', isActing && 'opacity-40')}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        disabled={isActing || lead.qualification_status === 'unqualified'}
                        onClick={() => handleQuickQualify(lead, 'unqualified')}
                        className={cn('rounded p-1 transition-all', lead.qualification_status === 'unqualified' ? 'text-rose-400' : 'text-gray-300 hover:text-rose-500', isActing && 'opacity-40')}
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-black/[0.05] px-5 py-3 text-[12px] text-gray-400 md:flex-row md:items-center md:justify-between">
          <span>
            عرض {formatWesternInt(showingFrom)}–{formatWesternInt(showingTo)} من {formatWesternInt(total)}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ q: query, qualification: qualificationFilter, sales: salesFilter, sort, dir, page: String(page - 1) })}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ArrowLeft className="-scale-x-100" size={14} /> السابق
              </Link>
            )}
            <span className="font-semibold text-gray-600">{formatWesternInt(page)} / {formatWesternInt(pages)}</span>
            {page < pages && (
              <Link
                href={buildHref({ q: query, qualification: qualificationFilter, sales: salesFilter, sort, dir, page: String(page + 1) })}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                التالي
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ══ Delete confirmation ══ */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <p className="text-base font-bold text-navy-900">
              حذف {deleteConfirm.first_name} {deleteConfirm.family_name ?? ''}؟
            </p>
            <p className="text-sm text-gray-500">
              {deleteConfirm.phone_number ?? deleteConfirm.phone_normalized}
              <br />لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3">
              <button
                disabled={actionPending === deleteConfirm.id + 'del'}
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionPending === deleteConfirm.id + 'del' ? 'جارٍ الحذف…' : 'حذف نهائي'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Details popup ══ */}
      <Dialog open={open} onOpenChange={(o) => { if (!pending) setOpen(o) }}>
        <DialogContent
          dir="rtl"
          className="crm-dialog-shell flex max-h-[92vh] max-w-[min(56rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:rounded-[1.65rem]"
          showCloseButton
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <DialogHeader className="border-b border-black/[0.06] px-6 pt-6 pb-5 text-start sm:px-7">
              <DialogTitle className="text-xl font-bold text-navy-900">
                {active?.first_name ?? ''} {active?.family_name ?? ''}
              </DialogTitle>
              <DialogDescription>
                <span className="flex flex-wrap items-center gap-2 text-[13px] text-gray-500 mt-1">
                  {(active?.phone_number ?? active?.phone_normalized) && (
                    <span dir="ltr" className="font-mono text-[12px] bg-gray-100 rounded px-2 py-0.5 flex items-center gap-1.5">
                      {active?.phone_number ?? active?.phone_normalized}
                      <button
                        onClick={() => copyToClipboard(active?.phone_number ?? active?.phone_normalized ?? '')}
                        title="نسخ"
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <Copy size={11} />
                      </button>
                      {waHref(active?.phone_number ?? active?.phone_normalized) && (
                        <a
                          href={waHref(active?.phone_number ?? active?.phone_normalized)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="فتح واتساب"
                          className="text-gray-400 hover:text-emerald-500 transition-colors"
                        >
                          <MessageCircle size={12} />
                        </a>
                      )}
                    </span>
                  )}
                  {active?.email && (
                    <span dir="ltr" className="text-[12px] break-all">{active.email}</span>
                  )}
                  {active && (
                    <span className={badgeQual(active.qualification_status)}>
                      {QUALIFICATION_LABELS[active.qualification_status]}
                    </span>
                  )}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-6 sm:px-7 space-y-6">
              {/* ── All lead fields ── */}
              <section>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">بيانات الفورم</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <D label="الاسم الأول"        value={active?.first_name} />
                  <D label="اسم العائلة"         value={active?.family_name} />
                  <D label="رقم الجوال"          value={active?.phone_number ?? active?.phone_normalized} mono />
                  <D label="البريد الإلكتروني"   value={active?.email} mono />
                  <D label="المدينة"             value={active?.city} />
                  <D label="إجمالي الراتب"       value={active?.salary_range_raw} />
                  <D label="البنك"               value={active?.bank_name} />
                  <D label="جهة العمل"           value={active?.employer_raw} />
                  <D label="المبلغ المطلوب"      value={active?.requested_amount_raw} />
                  <D label="تمويل عقاري قائم"   value={yn(active?.has_existing_mortgage)} />
                  <D label="إيقاف خدمات"        value={yn(active?.has_service_hold)} />
                  <D label="الدعم السكني"        value={active?.housing_support_raw} />
                  <D label="مصدر الزيارة"        value={active?.visit_source_raw} />
                  <D label="الحملة"              value={active?.campaign_raw} />
                  <D label="تاريخ الإرسال"       value={active?.funnel_submitted_at ? formatWesternDateTime(active.funnel_submitted_at) : undefined} />
                </dl>
              </section>

              <hr className="border-black/[0.06]" />

              {/* ── CRM controls ── */}
              <section className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">قرار التأهيل والمتابعة</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>التأهيل</Label>
                    <Select value={qual} disabled={staffRole !== 'admin'} onValueChange={(v) => setQual(v as QualificationStatus)}>
                      <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QUALIFICATION_ORDER.map((k) => (
                          <SelectItem key={k} value={k}>{QUALIFICATION_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>مرحلة المتابعة</Label>
                    <Select value={salesStat} onValueChange={(v) => setSalesStat(v as SalesWorkflowStatus)}>
                      <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SALES_WORKFLOW_ORDER.map((k) => (
                          <SelectItem key={k} value={k}>{SALES_STATUS_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {staffRole === 'admin' && (
                  <div className="space-y-1.5">
                    <Label>مسند إلى</Label>
                    <Select
                      value={assign || '__unassigned'}
                      onValueChange={(v) => setAssign(v === '__unassigned' ? '' : (v ?? ''))}
                    >
                      <SelectTrigger dir="rtl"><SelectValue placeholder="غير مسند" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned">غير مسند</SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.full_name ?? a.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>ملاحظات داخلية</Label>
                  <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} />
                </div>

                {/* Follow-up date */}
                <div className="space-y-1.5">
                  <Label>موعد المتابعة القادم</Label>
                  <input
                    type="datetime-local"
                    value={followupAt}
                    onChange={(e) => setFollowupAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
                    dir="ltr"
                  />
                  {followupAt && new Date(followupAt) < new Date() && (
                    <p className="text-[11px] font-semibold text-rose-500">⚠ الموعد متأخر — الرجاء التحديث</p>
                  )}
                </div>

                {(active?.import_conflict_notes ?? '').length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[12px] text-amber-900">
                    <p className="font-semibold mb-1">ملاحظات الاستيراد</p>
                    <p className="whitespace-pre-wrap">{active?.import_conflict_notes}</p>
                  </div>
                )}
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-black/[0.06] bg-gray-50/80 gap-3 px-6 py-4 sm:flex-row-reverse sm:justify-start sm:px-7">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={pending}>
              إغلاق
            </Button>
            {waHref(active?.phone_number ?? active?.phone_normalized) && (
              <a
                href={waHref(active?.phone_number ?? active?.phone_normalized)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <MessageCircle size={14} />
                واتساب
              </a>
            )}
            <Button
              type="button"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={persist}
              disabled={pending}
            >
              {pending ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
