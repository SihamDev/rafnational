import AdminTopbar from '@/components/admin/AdminTopbar'
import LeadsWorkbench from '@/components/admin/leads/LeadsWorkbench'
import { getStaffUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

import type { LeadRow } from '@/types/leads'
import { QUALIFICATION_ORDER, SALES_WORKFLOW_ORDER } from '@/types/leads'

const PAGE_SIZE = 35

const SORT_COLS = ['created_at', 'first_name', 'city', 'qualification_status'] as const
type SortCol = (typeof SORT_COLS)[number]

type DashboardRpc = {
  total: number
  in_window: number
  by_qualification?: Record<string, number>
  by_sales?: Record<string, number>
  by_source?: { label: string; value: number }[]
} | null

function spOne(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string {
  const raw = params?.[key]
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v.trim() : ''
}

function sanitizeIlike(segment: string) {
  return segment.replace(/[%_]/g, '').slice(0, 80)
}

export default async function LeadsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const staff = await getStaffUser()
  if (!staff) notFound()

  const sp = await searchParams
  const query = spOne(sp, 'q')

  const qualRaw = spOne(sp, 'qualification')
  const qualificationFilter =
    QUALIFICATION_ORDER.includes(
      qualRaw as (typeof QUALIFICATION_ORDER)[number],
    )
      ? (qualRaw as (typeof QUALIFICATION_ORDER)[number])
      : '__all'

  const salesRaw = spOne(sp, 'sales')
  const salesFilter = SALES_WORKFLOW_ORDER.includes(
    salesRaw as (typeof SALES_WORKFLOW_ORDER)[number],
  )
    ? (salesRaw as (typeof SALES_WORKFLOW_ORDER)[number])
    : '__all'

  const sortRaw = spOne(sp, 'sort')
  const sort: SortCol = SORT_COLS.includes(sortRaw as SortCol) ? (sortRaw as SortCol) : 'created_at'
  const dir: 'asc' | 'desc' = spOne(sp, 'dir') === 'asc' ? 'asc' : 'desc'

  const pageNumParsed = Number(spOne(sp, 'page') || '1')
  const page = Number.isFinite(pageNumParsed) && pageNumParsed > 0 ? Math.floor(pageNumParsed) : 1

  let qb = staff.supabase.from('leads').select('*', { count: 'exact' })

  if (staff.role === 'sales_agent') {
    qb = qb.eq('assigned_to', staff.user.id)
  }

  const safeSegment = sanitizeIlike(query)
  if (safeSegment) {
    const pat = `%${safeSegment}%`
    qb = qb.or(
      [
        `first_name.ilike.${pat}`,
        `family_name.ilike.${pat}`,
        `phone_number.ilike.${pat}`,
        `phone_normalized.ilike.${pat}`,
        `email.ilike.${pat}`,
        `city.ilike.${pat}`,
      ].join(','),
    )
  }

  if (qualificationFilter !== '__all') {
    qb = qb.eq('qualification_status', qualificationFilter)
  }

  if (salesFilter !== '__all') {
    qb = qb.eq('sales_workflow_status', salesFilter)
  }

  const from = (page - 1) * PAGE_SIZE

  qb = qb.order(sort, { ascending: dir === 'asc' }).range(from, from + PAGE_SIZE - 1)

  /* ── Run leads + agents + stats in parallel ── */
  const agentsQuery =
    staff.role === 'admin'
      ? staff.supabase.from('profiles').select('id, full_name').eq('role', 'sales_agent')
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] })

  const statsQuery = staff.supabase.rpc('crm_leads_dashboard_stats', { p_days: 90 })

  const [
    { data: rowsRaw, count, error },
    agentsRes,
    statsRes,
  ] = await Promise.all([qb, agentsQuery, statsQuery])

  if (error) throw new Error(error.message)

  const rows   = (rowsRaw ?? []) as LeadRow[]
  const agents = (agentsRes?.data ?? []) as { id: string; full_name: string | null }[]

  /* ── Profiles lookup for assigned names (only IDs not already in agents) ── */
  const agentIdSet = new Set(agents.map((a) => a.id))
  const assigneeIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))] as string[]
  const missingIds = assigneeIds.filter((id) => !agentIdSet.has(id))

  const assigneeLookup: Record<string, string | null> = {}
  agents.forEach((a) => { assigneeLookup[a.id] = a.full_name })

  if (missingIds.length) {
    const { data: profs } = await staff.supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', missingIds)
    ;(profs ?? []).forEach((p) => { assigneeLookup[p.id] = p.full_name ?? null })
  }

  let statsPayload: DashboardRpc = null
  try {
    if (statsRes.data != null && typeof statsRes.data === 'object') {
      statsPayload = statsRes.data as DashboardRpc
    }
  } catch {
    statsPayload = null
  }

  return (
    <>
      <AdminTopbar title="عملاء ومبيعات" breadcrumb="CRM" />
      <main className="flex-1">
        <LeadsWorkbench
          staffRole={staff.role}
          rows={rows}
          agents={agents}
          assigneeLookup={assigneeLookup}
          stats={statsPayload}
          total={count ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          query={query}
          qualificationFilter={qualificationFilter}
          salesFilter={salesFilter}
          sort={sort}
          dir={dir}
        />
      </main>
    </>
  )
}
