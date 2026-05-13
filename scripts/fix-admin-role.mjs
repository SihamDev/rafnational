import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const ADMIN_ID = 'f452e6c5-51dd-4171-a1c5-63bcc278895d'

const { error } = await sb
  .from('profiles')
  .update({ role: 'admin', full_name: 'Admin' })
  .eq('id', ADMIN_ID)

if (error) {
  console.error('❌ Error:', error.message)
} else {
  console.log('✅ Role restored → admin@rafnational.com is now admin again')
  console.log('   Email:    admin@rafnational.com')
  console.log('   Password: RafAdmin2026')
}
