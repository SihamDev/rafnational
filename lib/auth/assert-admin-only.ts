import { notFound } from 'next/navigation'
import { getStaffUser } from '@/lib/supabase/server'

/** Admin-only route guard — blocks sales_agent users */
export async function assertAdminOnly() {
  const staff = await getStaffUser()
  if (!staff || staff.role !== 'admin') notFound()
}
