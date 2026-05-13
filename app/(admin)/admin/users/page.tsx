import { getStaffUser, createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AdminTopbar from '@/components/admin/AdminTopbar'
import UsersClient from '@/components/admin/UsersClient'

export const metadata = { title: 'فريق المبيعات — راف الوطنية' }

export interface UserRow {
  id: string
  full_name: string | null
  phone: string | null
  role: string
  email: string
  created_at: string
  leads_count: number
}

export default async function UsersPage() {
  const staff = await getStaffUser()
  if (!staff || staff.role !== 'admin') notFound()

  const adminClient = await createAdminClient()

  // Fetch all three in parallel
  const [
    { data: profiles },
    { data: { users: authUsers } },
    { data: leadsRaw },
  ] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, full_name, phone, role, created_at')
      .order('created_at', { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    adminClient
      .from('leads')
      .select('assigned_to')
      .not('assigned_to', 'is', null),
  ])

  // Build email lookup from auth
  const emailById: Record<string, string> = {}
  for (const u of authUsers ?? []) {
    emailById[u.id] = u.email ?? ''
  }

  // Count leads per agent
  const leadsByAgent: Record<string, number> = {}
  for (const r of leadsRaw ?? []) {
    const aid = (r as { assigned_to: string }).assigned_to
    if (aid) leadsByAgent[aid] = (leadsByAgent[aid] ?? 0) + 1
  }

  const users: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    phone: p.phone,
    role: p.role ?? 'user',
    email: emailById[p.id] ?? '',
    created_at: p.created_at,
    leads_count: leadsByAgent[p.id] ?? 0,
  }))

  return (
    <>
      <AdminTopbar title="فريق المبيعات" breadcrumb="فريق المبيعات" />
      <main className="flex-1 p-6">
        <UsersClient initialUsers={users} currentUserId={staff.user.id} />
      </main>
    </>
  )
}
