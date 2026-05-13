'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function updateAppSetting(key: string, value: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { error: error.message }
  return {}
}

export async function createUserAccount(params: {
  email: string
  password: string
  full_name: string
  role: 'user' | 'admin' | 'sales_agent'
}) {
  const admin = await createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { full_name: params.full_name },
  })
  if (error) return { error: error.message }

  if (data.user) {
    // Always update profile: set full_name and role
    await admin
      .from('profiles')
      .update({
        full_name: params.full_name || null,
        role: params.role,
      })
      .eq('id', data.user.id)
  }

  return {}
}

export async function updateUserRole(userId: string, role: string) {
  const { user } = (await (await createClient()).auth.getUser()).data
  // Prevent admins from changing their own role
  if (user?.id === userId) return { error: 'لا يمكنك تغيير دورك الخاص' }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', userId)
  if (error) return { error: error.message }
  return {}
}

export async function deleteUserAccount(userId: string) {
  const { user } = (await (await createClient()).auth.getUser()).data
  // Prevent admins from deleting their own account
  if (user?.id === userId) return { error: 'لا يمكنك حذف حسابك الخاص' }

  const admin = await createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  return {}
}
