'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { safeInternalNext } from '@/lib/safe-next-path'

export async function signIn(email: string, password: string, nextUrl?: string | null) {
  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  const userId = authData.user?.id
  if (!userId) return { error: 'فشل تسجيل الدخول' }

  // Use service-role client to read role (bypasses RLS quirks during auth handshake)
  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (profile as any)?.role as 'admin' | 'sales_agent' | 'user' | undefined

  revalidatePath('/', 'layout')

  // Admin → dashboard; CRM sales agent → their own dashboard
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role === 'sales_agent') {
    redirect('/admin/agent')
  }

  const next = safeInternalNext(nextUrl)
  if (next) redirect(next)

  // Plain 'user' role has no dashboard access — redirect to login with message
  redirect('/login?error=no_access')
}

export async function signUp(email: string, password: string, full_name: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${process.env.APP_URL}/callback`,
    },
  })

  if (error) return { error: error.message }

  return { success: 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب.' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function forgotPassword(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.APP_URL}/callback?next=/reset-password`,
  })

  if (error) return { error: error.message }
  return { success: 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني.' }
}

export async function resetPassword(password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/admin')
}
