'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markNotificationRead(id: string) {
  const supabase = await createClient()
  await supabase
    .from('admin_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/admin', 'layout')
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('admin_notifications')
    .update({ read_at: new Date().toISOString() })
    .or(`admin_id.eq.${user.id},admin_id.is.null`)
    .is('read_at', null)
  revalidatePath('/admin', 'layout')
}
