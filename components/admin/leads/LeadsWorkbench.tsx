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
  Search,
  Trash2,
  UsersRound,
  XCircle,
  Columns3,
} from 'lucide-react'
import { toast } from 'sonner'

import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { effectiveQualificationStatus } from '@/lib/leads/auto-qualify'
import type { ResolvedQualification } from '@/lib/leads/auto-qualify'
import {
  QUALIFICATION_LABELS,
  QUALIFICATION_ORDER,
  SALES_STATUS_LABELS,
  SALES_WORKFLOW_ORDER,
  type ActiveQualificationStatus,
  type LeadRow,
  type SalesWorkflowStatus,
} from '@/types/leads'

function qualOf(
  lead: Pick<
    LeadRow,
    'qualification_status' | 'salary_range_raw' | 'has_existing_mortgage' | 'has_service_hold'
  >
): ResolvedQualification {
  return effectiveQualificationStatus(lead.qualification_status, lead)
}

/* ── SortIcon (must be outside component to satisfy react-hooks/static-components) ── */
function SortIcon({ col, sort, dir }: { col: string; sort: string; dir: string }) {
  if (sort !== col) return <ArrowUpDown size={11} className="ms-1 inline-block opacity-30" />
  return dir === 'asc' ? (
    <ArrowUp size={11} className="text-brand ms-1 inline-block" />
  ) : (
    <ArrowDown size={11} className="text-brand ms-1 inline-block" />
  )
}

/* ── Textarea style ── */
const textareaCls =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 min-h-[120px] w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 md:text-sm'

const filterSelectCls =
  'h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring rtl:text-right'

const LEADS_TABLE_COLUMNS_KEY = 'leads_table_visible_columns'

type TableColumnId =
  | 'client'
  | 'family_name'
  | 'phone'
  | 'email'
  | 'city'
  | 'salary'
  | 'bank'
  | 'employer'
  | 'requested_amount'
  | 'has_mortgage'
  | 'service_hold'
  | 'housing_support'
  | 'visit_source'
  | 'campaign'
  | 'financing_need'
  | 'date'
  | 'qualification'
  | 'sales_status'
  | 'actions'

const LEADS_TABLE_COLUMNS: {
  id: TableColumnId
  label: string
  defaultVisible: boolean
  adminOnly?: boolean
  required?: boolean
  sortKey?: string
}[] = [
  { id: 'client', label: 'العميل', defaultVisible: true, required: true, sortKey: 'first_name' },
  { id: 'family_name', label: 'اسم العائلة', defaultVisible: false },
  { id: 'phone', label: 'الجوال', defaultVisible: true },
  { id: 'email', label: 'البريد الإلكتروني', defaultVisible: false },
  { id: 'city', label: 'المدينة', defaultVisible: true, sortKey: 'city' },
  { id: 'salary', label: 'إجمالي الراتب', defaultVisible: false },
  { id: 'bank', label: 'البنك', defaultVisible: false },
  { id: 'employer', label: 'جهة العمل', defaultVisible: false },
  { id: 'requested_amount', label: 'المبلغ المطلوب', defaultVisible: false },
  { id: 'has_mortgage', label: 'تمويل عقاري قائم', defaultVisible: false },
  { id: 'service_hold', label: 'إيقاف خدمات', defaultVisible: false },
  { id: 'housing_support', label: 'الدعم السكني', defaultVisible: false },
  { id: 'visit_source', label: 'مصدر الزيارة', defaultVisible: false },
  { id: 'campaign', label: 'الحملة', defaultVisible: false },
  { id: 'financing_need', label: 'احتياج التمويل', defaultVisible: false },
  { id: 'date', label: 'تاريخ الإرسال', defaultVisible: true, sortKey: 'created_at' },
  { id: 'qualification', label: 'الأهلية', defaultVisible: true, sortKey: 'qualification_status' },
  { id: 'sales_status', label: 'مرحلة المتابعة', defaultVisible: false },
  { id: 'actions', label: 'الإجراءات', defaultVisible: true, adminOnly: true },
]

function PhoneCell({ phone }: { phone: string | null | undefined }) {
  const wa = phone ? waHref(phone) : null
  if (!phone) return <span>—</span>
  return (
    <div className="flex items-center gap-1.5">
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          title="فتح محادثة واتساب"
          className="text-emerald-700 underline decoration-emerald-500/40 underline-offset-2 transition-colors hover:text-emerald-600"
          onClick={(e) => e.stopPropagation()}
        >
          {phone}
        </a>
      ) : (
        <span>{phone}</span>
      )}
      <button
        type="button"
        onClick={() => copyToClipboard(phone)}
        title="نسخ"
        className="text-gray-300 transition-colors hover:text-gray-600"
      >
        <Copy size={11} />
      </button>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          title="فتح واتساب"
          aria-label="فتح واتساب"
          className="text-gray-400 transition-colors hover:text-gray-600"
          onClick={(e) => e.stopPropagation()}
        >
          <WhatsAppIcon size={12} />
        </a>
      )}
    </div>
  )
}

function LeadTableHeaderCell({
  col,
  sort,
  dir,
  sortHref,
}: {
  col: (typeof LEADS_TABLE_COLUMNS)[number]
  sort: string
  dir: string
  sortHref: (col: string) => string
}) {
  const thCls = cn('px-5 py-3 whitespace-nowrap', col.id === 'actions' && 'text-center')
  if (col.sortKey) {
    return (
      <th className={thCls}>
        <Link
          href={sortHref(col.sortKey)}
          className="flex items-center gap-0.5 hover:text-gray-600"
        >
          {col.label} <SortIcon col={col.sortKey} sort={sort} dir={dir} />
        </Link>
      </th>
    )
  }
  return <th className={thCls}>{col.label}</th>
}

function LeadTableBodyCell({
  col,
  lead,
  q,
  dateStr,
  isActing,
  onQuickQualify,
  onDelete,
}: {
  col: (typeof LEADS_TABLE_COLUMNS)[number]
  lead: LeadRow
  q: ResolvedQualification
  dateStr: string | null
  isActing: boolean
  onQuickQualify: (lead: LeadRow, status: 'qualified' | 'unqualified') => void
  onDelete: (lead: LeadRow) => void
}) {
  const name = `${lead.first_name ?? ''} ${lead.family_name ?? ''}`.trim()
  const phone = lead.phone_number ?? lead.phone_normalized

  switch (col.id) {
    case 'client':
      return (
        <td className="px-5 py-3.5">
          <p className="text-ink group-hover:text-brand flex items-center gap-1.5 leading-tight font-semibold transition-colors">
            {name || '—'}
            {lead.next_followup_at && lead.next_followup_at < new Date().toISOString() && (
              <span title="متابعة متأخرة" className="shrink-0 text-amber-500">
                <Clock size={11} />
              </span>
            )}
          </p>
        </td>
      )
    case 'family_name':
      return <td className="px-5 py-3.5 text-gray-700">{lead.family_name ?? '—'}</td>
    case 'phone':
      return (
        <td
          className="px-5 py-3.5 font-mono text-[12px] text-gray-600"
          dir="ltr"
          onClick={(e) => e.stopPropagation()}
        >
          <PhoneCell phone={phone} />
        </td>
      )
    case 'email':
      return (
        <td className="px-5 py-3.5 text-gray-600" dir="ltr">
          {lead.email ?? '—'}
        </td>
      )
    case 'city':
      return <td className="px-5 py-3.5 text-gray-600">{lead.city ?? '—'}</td>
    case 'salary':
      return <td className="px-5 py-3.5 text-gray-600">{lead.salary_range_raw ?? '—'}</td>
    case 'bank':
      return <td className="px-5 py-3.5 text-gray-600">{lead.bank_name ?? '—'}</td>
    case 'employer':
      return <td className="px-5 py-3.5 text-gray-600">{lead.employer_raw ?? '—'}</td>
    case 'requested_amount':
      return <td className="px-5 py-3.5 text-gray-600">{lead.requested_amount_raw ?? '—'}</td>
    case 'has_mortgage':
      return <td className="px-5 py-3.5 text-gray-600">{yn(lead.has_existing_mortgage)}</td>
    case 'service_hold':
      return <td className="px-5 py-3.5 text-gray-600">{yn(lead.has_service_hold)}</td>
    case 'housing_support':
      return <td className="px-5 py-3.5 text-gray-600">{lead.housing_support_raw ?? '—'}</td>
    case 'visit_source':
      return <td className="px-5 py-3.5 text-gray-600">{lead.visit_source_raw ?? '—'}</td>
    case 'campaign':
      return <td className="px-5 py-3.5 text-gray-600">{lead.campaign_raw ?? '—'}</td>
    case 'financing_need':
      return <td className="px-5 py-3.5 text-gray-600">{lead.financing_need_raw ?? '—'}</td>
    case 'date':
      return (
        <td className="px-5 py-3.5 font-mono text-[11px] whitespace-nowrap text-gray-400">
          {dateStr ? formatWesternDateOnly(dateStr) : '—'}
        </td>
      )
    case 'qualification':
      return (
        <td className="px-5 py-3.5 whitespace-nowrap">
          <span className={badgeQual(q)}>{QUALIFICATION_LABELS[q]}</span>
        </td>
      )
    case 'sales_status':
      return (
        <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
          {SALES_STATUS_LABELS[lead.sales_workflow_status] ?? lead.sales_workflow_status}
        </td>
      )
    case 'actions':
      return (
        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              disabled={isActing || q === 'qualified'}
              onClick={() => onQuickQualify(lead, 'qualified')}
              title="قبول"
              className={cn(
                'rounded-lg p-1.5 transition-all',
                q === 'qualified'
                  ? 'cursor-default text-emerald-400'
                  : 'text-gray-300 hover:bg-emerald-50 hover:text-emerald-600 active:scale-95',
                isActing && 'pointer-events-none opacity-40'
              )}
            >
              <CheckCircle2 size={18} />
            </button>
            <button
              type="button"
              disabled={isActing || q === 'unqualified'}
              onClick={() => onQuickQualify(lead, 'unqualified')}
              title="رفض"
              className={cn(
                'rounded-lg p-1.5 transition-all',
                q === 'unqualified'
                  ? 'cursor-default text-rose-400'
                  : 'text-gray-300 hover:bg-rose-50 hover:text-rose-500 active:scale-95',
                isActing && 'pointer-events-none opacity-40'
              )}
            >
              <XCircle size={18} />
            </button>
            <button
              type="button"
              disabled={isActing}
              onClick={() => onDelete(lead)}
              title="حذف"
              className={cn(
                'rounded-lg p-1.5 text-gray-300 transition-all hover:bg-red-50 hover:text-red-500 active:scale-95',
                isActing && 'pointer-events-none opacity-40'
              )}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      )
    default:
      return null
  }
}

function defaultColumnVisibility(staffRole: StaffRole): Record<TableColumnId, boolean> {
  const out = {} as Record<TableColumnId, boolean>
  for (const col of LEADS_TABLE_COLUMNS) {
    if (col.adminOnly && staffRole !== 'admin') continue
    out[col.id] = col.defaultVisible
  }
  return out
}

function loadColumnVisibility(staffRole: StaffRole): Record<TableColumnId, boolean> {
  const defaults = defaultColumnVisibility(staffRole)
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(LEADS_TABLE_COLUMNS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Record<TableColumnId, boolean>>
    const merged = { ...defaults }
    for (const col of LEADS_TABLE_COLUMNS) {
      if (col.adminOnly && staffRole !== 'admin') continue
      if (typeof parsed[col.id] === 'boolean') merged[col.id] = parsed[col.id]!
    }
    if (!merged.client) merged.client = true
    return merged
  } catch {
    return defaults
  }
}

/* ── Badge helpers ── */
function badgeQual(q: ResolvedQualification) {
  const cls =
    q === 'qualified'
      ? 'bg-emerald-100 text-emerald-800 ring-emerald-500/25'
      : 'bg-rose-100 text-rose-800 ring-rose-400/40'
  return cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', cls)
}

/* ── URL builder ── */
function buildHref(parts: Record<string, string>) {
  const filtered = Object.fromEntries(
    Object.entries(parts).filter(([, v]) => v !== '' && v !== '__all')
  )
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
      <dt className="text-[11px] font-semibold tracking-wide text-gray-400">{label}</dt>
      <dd
        className={cn(
          'text-[13px] font-medium break-words text-gray-800',
          mono && 'font-mono text-[12px]'
        )}
      >
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
  if (digits.startsWith('5') && digits.length === 9) return `966${digits}`
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
    () => toast.error('فشل النسخ')
  )
}

/* ── Export rows to CSV ── */
function exportCsv(rows: LeadRow[]) {
  const headers = [
    'الاسم الأول',
    'اسم العائلة',
    'الجوال',
    'البريد',
    'المدينة',
    'الراتب',
    'البنك',
    'جهة العمل',
    'المبلغ المطلوب',
    'تمويل قائم',
    'إيقاف خدمات',
    'دعم سكني',
    'مصدر الزيارة',
    'التأهيل',
    'مرحلة المبيعات',
    'تاريخ الإرسال',
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
    QUALIFICATION_LABELS[qualOf(l)],
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

  /* ── Detail dialog ── */
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<LeadRow | null>(null)
  const [qual, setQual] = useState<ActiveQualificationStatus>('qualified')
  const [salesStat, setSalesStat] = useState<SalesWorkflowStatus>('new')
  const [assign, setAssign] = useState('')
  const [notes, setNotes] = useState('')
  const [followupAt, setFollowupAt] = useState<string>('')

  /* ── Inline actions ── */
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<LeadRow | null>(null)

  /* ── Table column visibility ── */
  const [columnVisibility, setColumnVisibility] = useState<Record<TableColumnId, boolean>>(() =>
    defaultColumnVisibility(staffRole)
  )

  useEffect(() => {
    setColumnVisibility(loadColumnVisibility(staffRole))
  }, [staffRole])

  const isColVisible = (id: TableColumnId) => Boolean(columnVisibility[id])

  const visibleTableColumns = LEADS_TABLE_COLUMNS.filter(
    (c) => (!c.adminOnly || staffRole === 'admin') && isColVisible(c.id)
  )
  const visibleColumnCount = visibleTableColumns.length

  function setColumnVisible(id: TableColumnId, visible: boolean) {
    const col = LEADS_TABLE_COLUMNS.find((c) => c.id === id)
    if (col?.required && !visible) return
    setColumnVisibility((prev) => {
      const next = { ...prev, [id]: visible }
      const shown = LEADS_TABLE_COLUMNS.filter(
        (c) => (!c.adminOnly || staffRole === 'admin') && next[c.id]
      ).length
      if (shown === 0) return prev
      localStorage.setItem(LEADS_TABLE_COLUMNS_KEY, JSON.stringify(next))
      return next
    })
  }

  const tableColumnsForMenu = LEADS_TABLE_COLUMNS.filter(
    (c) => !c.adminOnly || staffRole === 'admin'
  )

  /* ── Debounced search ── */
  const [searchInput, setSearchInput] = useState(query)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams()
      if (value) params.set('q', value)
      if (qualificationFilter && qualificationFilter !== '__all')
        params.set('qualification', qualificationFilter)
      if (salesFilter && salesFilter !== '__all') params.set('sales', salesFilter)
      if (sort !== 'created_at') params.set('sort', sort)
      if (dir !== 'desc') params.set('dir', dir)
      router.replace(`/admin/leads?${params.toString()}`)
    },
    [qualificationFilter, salesFilter, sort, dir, router]
  )

  useEffect(() => {
    if (searchInput === query) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => pushSearch(searchInput), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  /* ── Sort helpers ── */
  function sortHref(col: string) {
    const newDir = sort === col ? (dir === 'asc' ? 'desc' : 'asc') : 'desc'
    return buildHref({
      q: query,
      qualification: qualificationFilter,
      sales: salesFilter,
      sort: col,
      dir: newDir,
      page: '1',
    })
  }

  /* ── Open lead detail ── */
  function openLead(l: LeadRow) {
    setActive(l)
    setQual(qualOf(l))
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
        else {
          toast.success('تم تحديث العميل')
          router.refresh()
          setOpen(false)
        }
      } else {
        const res = await agentUpdateLead(active.id, {
          sales_workflow_status: salesStat,
          internal_notes: notes || null,
          next_followup_at: followupAt ? new Date(followupAt).toISOString() : null,
        })
        if (res?.error) toast.error(res.error)
        else {
          toast.success('تم حفظ الملاحظات')
          router.refresh()
          setOpen(false)
        }
      }
    })
  }

  function handleQuickQualify(lead: LeadRow, status: 'qualified' | 'unqualified') {
    setActionPending(lead.id + status)
    start(async () => {
      const res = await quickQualifyLead(lead.id, status)
      setActionPending(null)
      if (res?.error) toast.error(res.error)
      else {
        toast.success(status === 'qualified' ? 'تم قبول العميل ✓' : 'تم رفض العميل')
        router.refresh()
      }
    })
  }

  function handleDelete(lead: LeadRow) {
    setActionPending(lead.id + 'del')
    start(async () => {
      const res = await deleteLead(lead.id)
      setActionPending(null)
      setDeleteConfirm(null)
      if (res?.error) toast.error(res.error)
      else {
        toast.success('تم حذف العميل')
        router.refresh()
      }
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
    <div className="space-y-4 p-5 md:p-6" dir="rtl">
      {/* ── Stat pills (clickable filters) ── */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: 'الكل',
            value: stats?.total ?? total,
            cls: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            href: buildHref({ q: query, sales: salesFilter }),
          },
          {
            label: 'مؤهَّل',
            value: byQ.qualified ?? '—',
            cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
            href: buildHref({ q: query, qualification: 'qualified', sales: salesFilter }),
          },
          {
            label: 'غير مؤهَّل',
            value: byQ.unqualified ?? '—',
            cls: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
            href: buildHref({ q: query, qualification: 'unqualified', sales: salesFilter }),
          },
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
      <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-sm">
        {/* Filter / toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.05] px-5 py-3">
          <UsersRound size={15} className="text-brand shrink-0" />
          <span className="text-ink me-1 text-sm font-bold">{formatWesternInt(total)} عميل</span>

          {/* Live search */}
          <div className="relative min-w-[180px] flex-1">
            <Search
              size={13}
              className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400"
            />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="بحث باسم أو جوال..."
              className="h-8 ps-8 text-sm"
            />
          </div>

          {/* Qualification filter */}
          <select
            value={qualificationFilter || '__all'}
            onChange={(e) =>
              router.replace(
                buildHref({
                  q: searchInput,
                  qualification: e.target.value,
                  sales: salesFilter,
                  sort,
                  dir,
                  page: '1',
                })
              )
            }
            className={filterSelectCls}
          >
            <option value="__all">كل الحالات</option>
            {QUALIFICATION_ORDER.map((k) => (
              <option key={k} value={k}>
                {QUALIFICATION_LABELS[k]}
              </option>
            ))}
          </select>

          {/* Sales filter */}
          <select
            value={salesFilter || '__all'}
            onChange={(e) =>
              router.replace(
                buildHref({
                  q: searchInput,
                  qualification: qualificationFilter,
                  sales: e.target.value,
                  sort,
                  dir,
                  page: '1',
                })
              )
            }
            className={filterSelectCls}
          >
            <option value="__all">كل المراحل</option>
            {SALES_WORKFLOW_ORDER.map((k) => (
              <option key={k} value={k}>
                {SALES_STATUS_LABELS[k]}
              </option>
            ))}
          </select>

          {/* Clear */}
          {(searchInput || qualificationFilter !== '__all' || salesFilter !== '__all') && (
            <button
              onClick={() => {
                setSearchInput('')
                router.replace('/admin/leads')
              }}
              className="text-xs whitespace-nowrap text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
            >
              مسح الكل
            </button>
          )}

          <div className="ms-auto flex items-center gap-2">
            {/* Column visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50">
                <Columns3 size={13} />
                الأعمدة
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-[min(70vh,22rem)] !w-[200px] overflow-y-auto py-1.5"
              >
                <DropdownMenuGroup className="w-full">
                  <DropdownMenuLabel className="px-2 text-[11px]">إظهار الأعمدة</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {tableColumnsForMenu.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={isColVisible(col.id)}
                      disabled={col.required}
                      className="py-2 ps-2 pe-3 whitespace-nowrap"
                      onCheckedChange={(checked) => setColumnVisible(col.id, checked === true)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export */}
            <button
              type="button"
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
              title="تصدير CSV"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <Download size={13} />
              تصدير
            </button>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-right text-[13px]">
            <thead className="border-b border-black/[0.05] bg-gray-50/80 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
              <tr>
                {visibleTableColumns.map((col) => (
                  <LeadTableHeaderCell
                    key={col.id}
                    col={col}
                    sort={sort}
                    dir={dir}
                    sortHref={sortHref}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {rows.map((lead) => {
                const isActing = actionPending?.startsWith(lead.id)
                const q = qualOf(lead)
                const date = lead.funnel_submitted_at ?? lead.created_at
                return (
                  <tr
                    key={lead.id}
                    onClick={() => openLead(lead)}
                    className={cn(
                      'group cursor-pointer transition-colors',
                      lead.next_followup_at && lead.next_followup_at < new Date().toISOString()
                        ? 'bg-amber-50/60 hover:bg-amber-50'
                        : q === 'qualified'
                          ? 'bg-emerald-50/50 hover:bg-emerald-50'
                          : 'bg-rose-50/40 hover:bg-rose-50/80'
                    )}
                  >
                    {visibleTableColumns.map((col) => (
                      <LeadTableBodyCell
                        key={col.id}
                        col={col}
                        lead={lead}
                        q={q}
                        dateStr={date}
                        isActing={!!isActing}
                        onQuickQualify={handleQuickQualify}
                        onDelete={setDeleteConfirm}
                      />
                    ))}
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={Math.max(visibleColumnCount, 1)}
                    className="py-16 text-center text-sm text-gray-400"
                  >
                    لا توجد نتائج — جرّب تغيير الفلتر أو مسح البحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="divide-y divide-black/[0.05] md:hidden">
          {rows.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">لا توجد نتائج.</p>
          )}
          {rows.map((lead) => {
            const isActing = actionPending?.startsWith(lead.id)
            const q = qualOf(lead)
            const name = `${lead.first_name ?? ''} ${lead.family_name ?? ''}`.trim()
            return (
              <div
                key={lead.id}
                onClick={() => openLead(lead)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors',
                  q === 'qualified' ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-rose-50/40'
                )}
              >
                {/* Avatar initial */}
                <div className="bg-ink text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                  {(lead.first_name ?? '؟')[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate font-semibold">{name || '—'}</p>
                  <p className="mt-0.5 font-mono text-[12px]" dir="ltr">
                    {(() => {
                      const phone = lead.phone_number ?? lead.phone_normalized
                      const wa = phone ? waHref(phone) : null
                      if (!phone) return <span className="text-gray-400">—</span>
                      if (!wa) return <span className="text-gray-400">{phone}</span>
                      return (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="فتح محادثة واتساب"
                          className="text-emerald-700 underline decoration-emerald-500/40 underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {phone}
                        </a>
                      )
                    })()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={badgeQual(q)}>{QUALIFICATION_LABELS[q]}</span>
                  {staffRole === 'admin' && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        disabled={isActing || q === 'qualified'}
                        onClick={() => handleQuickQualify(lead, 'qualified')}
                        className={cn(
                          'rounded p-1 transition-all',
                          q === 'qualified'
                            ? 'text-emerald-400'
                            : 'text-gray-300 hover:text-emerald-600',
                          isActing && 'opacity-40'
                        )}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        disabled={isActing || q === 'unqualified'}
                        onClick={() => handleQuickQualify(lead, 'unqualified')}
                        className={cn(
                          'rounded p-1 transition-all',
                          q === 'unqualified'
                            ? 'text-rose-400'
                            : 'text-gray-300 hover:text-rose-500',
                          isActing && 'opacity-40'
                        )}
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
            عرض {formatWesternInt(showingFrom)}–{formatWesternInt(showingTo)} من{' '}
            {formatWesternInt(total)}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={buildHref({
                  q: query,
                  qualification: qualificationFilter,
                  sales: salesFilter,
                  sort,
                  dir,
                  page: String(page - 1),
                })}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ArrowLeft className="-scale-x-100" size={14} /> السابق
              </Link>
            )}
            <span className="font-semibold text-gray-600">
              {formatWesternInt(page)} / {formatWesternInt(pages)}
            </span>
            {page < pages && (
              <Link
                href={buildHref({
                  q: query,
                  qualification: qualificationFilter,
                  sales: salesFilter,
                  sort,
                  dir,
                  page: String(page + 1),
                })}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <p className="text-ink text-base font-bold">
              حذف {deleteConfirm.first_name} {deleteConfirm.family_name ?? ''}؟
            </p>
            <p className="text-sm text-gray-500">
              {deleteConfirm.phone_number ?? deleteConfirm.phone_normalized}
              <br />
              لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3">
              <button
                disabled={actionPending === deleteConfirm.id + 'del'}
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {actionPending === deleteConfirm.id + 'del' ? 'جارٍ الحذف…' : 'حذف نهائي'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Details popup ══ */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!pending) setOpen(o)
        }}
      >
        <DialogContent
          dir="rtl"
          className="crm-dialog-shell flex max-h-[92vh] max-w-[min(56rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:rounded-[1.65rem]"
          showCloseButton
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <DialogHeader className="border-b border-black/[0.06] px-6 pt-6 pb-5 text-start sm:px-7">
              <DialogTitle className="text-ink text-xl font-bold">
                {active?.first_name ?? ''} {active?.family_name ?? ''}
              </DialogTitle>
              <DialogDescription>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
                  {(active?.phone_number ?? active?.phone_normalized) && (
                    <span
                      dir="ltr"
                      className="flex items-center gap-1.5 rounded bg-gray-100 px-2 py-0.5 font-mono text-[12px]"
                    >
                      {active?.phone_number ?? active?.phone_normalized}
                      <button
                        onClick={() =>
                          copyToClipboard(active?.phone_number ?? active?.phone_normalized ?? '')
                        }
                        title="نسخ"
                        className="text-gray-400 transition-colors hover:text-gray-700"
                      >
                        <Copy size={11} />
                      </button>
                      {waHref(active?.phone_number ?? active?.phone_normalized) && (
                        <a
                          href={waHref(active?.phone_number ?? active?.phone_normalized)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="فتح واتساب"
                          aria-label="فتح واتساب"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a]"
                        >
                          <WhatsAppIcon size={12} />
                        </a>
                      )}
                    </span>
                  )}
                  {active?.email && (
                    <span dir="ltr" className="text-[12px] break-all">
                      {active.email}
                    </span>
                  )}
                  {active && (
                    <span className={badgeQual(qualOf(active))}>
                      {QUALIFICATION_LABELS[qualOf(active)]}
                    </span>
                  )}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 px-6 py-6 sm:px-7">
              {/* ── All lead fields ── */}
              <section>
                <p className="mb-3 text-[11px] font-bold tracking-widest text-gray-400 uppercase">
                  بيانات الفورم
                </p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <D label="الاسم الأول" value={active?.first_name} />
                  <D label="اسم العائلة" value={active?.family_name} />
                  <D
                    label="رقم الجوال"
                    value={active?.phone_number ?? active?.phone_normalized}
                    mono
                  />
                  <D label="البريد الإلكتروني" value={active?.email} mono />
                  <D label="المدينة" value={active?.city} />
                  <D label="إجمالي الراتب" value={active?.salary_range_raw} />
                  <D label="البنك" value={active?.bank_name} />
                  <D label="جهة العمل" value={active?.employer_raw} />
                  <D label="المبلغ المطلوب" value={active?.requested_amount_raw} />
                  <D label="تمويل عقاري قائم" value={yn(active?.has_existing_mortgage)} />
                  <D label="إيقاف خدمات" value={yn(active?.has_service_hold)} />
                  <D label="الدعم السكني" value={active?.housing_support_raw} />
                  <D label="مصدر الزيارة" value={active?.visit_source_raw} />
                  <D label="الحملة" value={active?.campaign_raw} />
                  <D
                    label="تاريخ الإرسال"
                    value={
                      active?.funnel_submitted_at
                        ? formatWesternDateTime(active.funnel_submitted_at)
                        : undefined
                    }
                  />
                </dl>
              </section>

              <hr className="border-black/[0.06]" />

              {/* ── CRM controls ── */}
              <section className="space-y-4">
                <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">
                  قرار التأهيل والمتابعة
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>التأهيل</Label>
                    <Select
                      value={qual}
                      disabled={staffRole !== 'admin'}
                      onValueChange={(v) => setQual(v as ActiveQualificationStatus)}
                    >
                      <SelectTrigger dir="rtl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALIFICATION_ORDER.map((k) => (
                          <SelectItem key={k} value={k}>
                            {QUALIFICATION_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>مرحلة المتابعة</Label>
                    <Select
                      value={salesStat}
                      onValueChange={(v) => setSalesStat(v as SalesWorkflowStatus)}
                    >
                      <SelectTrigger dir="rtl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SALES_WORKFLOW_ORDER.map((k) => (
                          <SelectItem key={k} value={k}>
                            {SALES_STATUS_LABELS[k]}
                          </SelectItem>
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
                      <SelectTrigger dir="rtl">
                        <SelectValue placeholder="غير مسند" />
                      </SelectTrigger>
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
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={textareaCls}
                  />
                </div>

                {/* Follow-up date */}
                <div className="space-y-1.5">
                  <Label>موعد المتابعة القادم</Label>
                  <input
                    type="datetime-local"
                    value={followupAt}
                    onChange={(e) => setFollowupAt(e.target.value)}
                    className="focus:border-brand focus:ring-brand/20 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700 transition-colors focus:ring-2 focus:outline-none"
                    dir="ltr"
                  />
                  {followupAt && new Date(followupAt) < new Date() && (
                    <p className="text-[11px] font-semibold text-rose-500">
                      ⚠ الموعد متأخر — الرجاء التحديث
                    </p>
                  )}
                </div>

                {(active?.import_conflict_notes ?? '').length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[12px] text-amber-900">
                    <p className="mb-1 font-semibold">ملاحظات الاستيراد</p>
                    <p className="whitespace-pre-wrap">{active?.import_conflict_notes}</p>
                  </div>
                )}
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-3 border-t border-black/[0.06] bg-gray-50/80 px-6 py-4 sm:flex-row-reverse sm:justify-start sm:px-7">
            <Button
              variant="outline"
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              إغلاق
            </Button>
            {waHref(active?.phone_number ?? active?.phone_normalized) && (
              <a
                href={waHref(active?.phone_number ?? active?.phone_normalized)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <WhatsAppIcon size={14} />
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
