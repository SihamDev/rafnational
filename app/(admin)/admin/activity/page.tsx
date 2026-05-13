import { createClient } from '@/lib/supabase/server'
import { assertAdminOnly } from '@/lib/auth/assert-admin-only'
import AdminTopbar from '@/components/admin/AdminTopbar'
import ActivityClient from '@/components/admin/ActivityClient'
import type { ActivityLog } from '@/types'

export default async function ActivityPage() {
  await assertAdminOnly()
  const supabase = await createClient()

  const { data } = await supabase
    .from('activity_log')
    .select(
      'id, actor_id, action, entity_type, entity_id, metadata, created_at, actor:profiles(full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  const logs = (data ?? []) as unknown as ActivityLog[]

  return (
    <>
      <AdminTopbar title="سجل النشاطات" breadcrumb="سجل النشاطات" />
      <main className="flex-1 p-6">
        <ActivityClient initialLogs={logs} />
      </main>
    </>
  )
}
