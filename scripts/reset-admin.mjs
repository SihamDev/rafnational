import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// List all users
const { data: { users }, error } = await supabase.auth.admin.listUsers()
if (error) { console.error('Error:', error.message); process.exit(1) }

console.log('\nAll users in Supabase Auth:')
for (const u of users) {
  console.log(`  - ${u.email} | id: ${u.id} | confirmed: ${!!u.email_confirmed_at}`)
}

// Reset admin password to a known value
const adminUser = users.find(u => u.email?.includes('admin') || u.email?.includes('raf'))
if (adminUser) {
  const NEW_PASSWORD = 'RafAdmin2026'
  const { error: resetErr } = await supabase.auth.admin.updateUserById(adminUser.id, {
    password: NEW_PASSWORD,
    email_confirm: true,
  })
  if (resetErr) {
    console.error('\nPassword reset failed:', resetErr.message)
  } else {
    console.log(`\n✅ Password reset for: ${adminUser.email}`)
    console.log(`   New password: ${NEW_PASSWORD}`)
  }
} else {
  // No admin found — create one
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: 'admin@rafnational.com',
    password: 'RafAdmin2026',
    email_confirm: true,
    user_metadata: { full_name: 'Admin' },
  })
  if (createErr) {
    console.error('\nCreate failed:', createErr.message)
  } else {
    // Set admin role in profiles
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', newUser.user.id)
    console.log('\n✅ New admin created:')
    console.log('   Email:    admin@rafnational.com')
    console.log('   Password: RafAdmin2026')
  }
}
