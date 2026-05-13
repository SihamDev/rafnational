import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { count } = await supabase
  .from('leads')
  .select('*', { count: 'exact', head: true })

console.log('Total leads in DB:', count)

const { data: sample } = await supabase
  .from('leads')
  .select('first_name, family_name, phone_number, city, qualification_status, sales_workflow_status, visit_source_raw, created_at')
  .order('created_at', { ascending: false })
  .limit(5)

console.log('\nLatest 5 leads:')
for (const r of sample ?? []) {
  console.log(
    `  • ${r.first_name} ${r.family_name ?? ''} | ${r.phone_number ?? '-'} | ${r.city ?? '-'} | ${r.qualification_status} / ${r.sales_workflow_status}`,
  )
}

const { data: byStatus } = await supabase
  .from('leads')
  .select('qualification_status')

const counts = {}
for (const r of byStatus ?? []) {
  counts[r.qualification_status] = (counts[r.qualification_status] ?? 0) + 1
}
console.log('\nBy qualification:', counts)
