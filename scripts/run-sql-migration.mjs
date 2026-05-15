/**
 * run-sql-migration.mjs
 * =====================
 * ينفّذ ملف SQL migration عبر Supabase REST (rpc exec_sql).
 * يستخدم service_role key لتخطي RLS.
 *
 * الاستخدام:
 *   node --env-file=.env.local scripts/run-sql-migration.mjs <migration-file>
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const file             = process.argv[2]

if (!file) {
  console.error('❌ استخدم: node --env-file=.env.local scripts/run-sql-migration.mjs <migration-file>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const fullPath = path.join(process.cwd(), 'supabase', 'migrations', file)
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ الملف غير موجود: ${fullPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(fullPath, 'utf8')
  console.log(`\n📄 تشغيل: ${file}`)

  // Split on double newlines between statements (simple split)
  // Execute as one block via direct Supabase DB call
  const { error } = await supabase.rpc('exec_sql', { sql }).maybeSingle()

  if (error) {
    // exec_sql may not exist — use pg via supabase REST
    console.log('⚠️  exec_sql RPC غير متوفر، جارٍ التقسيم اليدوي...')

    // Split SQL into individual statements, trim, filter empty
    const statements = sql
      .replace(/--[^\n]*/g, '')     // remove line comments
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 5)

    console.log(`📦 عدد التعليمات: ${statements.length}`)
    let ok = 0, failed = 0
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      const preview = stmt.slice(0, 60).replace(/\n/g, ' ')
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ query: stmt }),
        })
        if (res.ok || res.status === 204) {
          ok++
        } else {
          const t = await res.text()
          console.warn(`  ⚠️  [${i+1}] ${preview}... → HTTP ${res.status}: ${t.slice(0,100)}`)
          failed++
        }
      } catch (e) {
        console.warn(`  ⚠️  [${i+1}] ${preview}... → ${e.message}`)
        failed++
      }
    }
    console.log(`\n✅ نجح: ${ok} | ❌ فشل: ${failed}\n`)
  } else {
    console.log(`✅ تم تشغيل ${file} بنجاح\n`)
  }
}

main().catch(e => { console.error('💥', e); process.exit(1) })
