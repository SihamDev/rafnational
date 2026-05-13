import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

import type { StaffRole } from '@/types/leads'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — reads only; mutations handled in middleware
          }
        },
      },
    }
  )
}

export type { StaffRole }

/**
 * Authenticated admin OR sales_agent for CRM area.
 * Wrapped in React.cache() so layout + topbar + page share one lookup.
 */
export const getStaffUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (profile as any)?.role as string | undefined

  if (role !== 'admin' && role !== 'sales_agent') return null
  return { user, supabase, role: role as StaffRole }
})

/**
 * Strict admin only — admin-restricted CRM modules.
 */
export const getAdminUser = cache(async () => {
  const staff = await getStaffUser()
  if (!staff || staff.role !== 'admin') return null
  return staff
})

/** Service-role client — use only in trusted server contexts */
export async function createAdminClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
