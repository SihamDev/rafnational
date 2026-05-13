import { createClient } from '@/lib/supabase/server'
import { assertAdminOnly } from '@/lib/auth/assert-admin-only'
import AdminTopbar from '@/components/admin/AdminTopbar'
import SettingsClient from '@/components/admin/SettingsClient'

export default async function SettingsPage() {
  await assertAdminOnly()
  const supabase = await createClient()

  const { data } = await supabase.from('app_settings').select('*')
  const settings: Record<string, Record<string, unknown>> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value as Record<string, unknown>
  }

  return (
    <>
      <AdminTopbar title="الإعدادات" breadcrumb="الإعدادات" />
      <main className="flex-1 p-6">
        <SettingsClient initialSettings={settings} />
      </main>
    </>
  )
}
