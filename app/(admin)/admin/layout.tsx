import { getStaffUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getStaffUser()
  if (!staff) notFound()

  let newLeads = 0
  {
    let q = staff.supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('sales_workflow_status', 'new')

    if (staff.role === 'sales_agent') {
      q = q.eq('assigned_to', staff.user.id)
    }

    const { count } = await q
    newLeads = count ?? 0
  }

  return (
    <div className="bg-crm-shell flex min-h-screen">
      <AdminSidebar leadsNewCount={newLeads} staffRole={staff.role} />
      <div className="crm-content flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
