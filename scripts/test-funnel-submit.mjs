/**
 * test-funnel-submit.mjs
 *
 * End-to-end test for the /api/leads/submit endpoint.
 * Run: node --env-file=.env.local scripts/test-funnel-submit.mjs
 *
 * What it tests:
 *   1. Valid submission → 201 created
 *   2. Duplicate phone  → 200 duplicate flag
 *   3. Bad secret       → 401
 *   4. Missing name     → 400 validation error
 *   5. Honeypot trigger → 400
 */

const BASE_URL = process.env.APP_URL ?? 'http://localhost:3030'
const SECRET   = process.env.FUNNEL_SUBMIT_SECRET

if (!SECRET) {
  console.error('❌  FUNNEL_SUBMIT_SECRET not set — run with --env-file=.env.local')
  process.exit(1)
}

const ENDPOINT = `${BASE_URL}/api/leads/submit`

/* ── helpers ── */
let passed = 0
let failed = 0

async function run(label, fn) {
  try {
    await fn()
    console.log(`  ✅  ${label}`)
    passed++
  } catch (e) {
    console.error(`  ❌  ${label}`)
    console.error(`     ${e.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function post(body, headers = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-funnel-secret': SECRET,
      ...headers,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json }
}

/* ── unique phone so we don't duplicate on repeated runs ── */
const testPhone = `0500${Date.now().toString().slice(-6)}`

/* ══════════════════════════════════════════
   Test suite
══════════════════════════════════════════ */
console.log(`\n🧪  Funnel API Tests → ${ENDPOINT}\n`)

await run('1. Valid submission returns 201 + id', async () => {
  const { status, body } = await post({
    first_name: 'تجربة',
    family_name: 'اختبار',
    phone_number: testPhone,
    city: 'الرياض',
    salary_range_raw: '10,000 – 15,000',
    bank_name: 'الراجحي',
    has_existing_mortgage: 'لا',
    has_service_hold: 'لا',
    visit_source_raw: 'TikTok',
    utm_source: 'tiktok',
    utm_campaign: 'test_campaign_2026',
    submitted_date: new Date().toISOString().slice(0, 10),
  })
  assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`)
  assert(body.ok === true, `Expected ok: true, got ${JSON.stringify(body)}`)
  assert(body.status === 'created', `Expected status: created`)
  assert(typeof body.id === 'string', `Expected id string, got ${typeof body.id}`)
})

await run('2. Duplicate phone returns 200 + duplicate flag', async () => {
  const { status, body } = await post({
    first_name: 'تجربة',
    phone_number: testPhone, // same phone as test 1
    city: 'جدة',
  })
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`)
  assert(body.ok === true, `Expected ok: true`)
  assert(body.duplicate === true, `Expected duplicate: true, got ${JSON.stringify(body)}`)
  assert(body.status === 'duplicate', `Expected status: duplicate`)
  console.log(`       → Duplicate detected, existing id: ${body.id}`)
})

await run('3. Wrong secret returns 401', async () => {
  const { status } = await post(
    { first_name: 'test', phone_number: '0500000000' },
    { 'x-funnel-secret': 'WRONG_SECRET' }
  )
  assert(status === 401, `Expected 401, got ${status}`)
})

await run('4. Missing first_name returns 400 validation error', async () => {
  const { status, body } = await post({
    phone_number: `0501${Date.now().toString().slice(-6)}`,
    city: 'الرياض',
    // first_name intentionally omitted
  })
  assert(status === 400, `Expected 400, got ${status}: ${JSON.stringify(body)}`)
  assert(body.ok === false, `Expected ok: false`)
  console.log(`       → Error: ${body.error}`)
})

await run('5. Honeypot field triggers 400', async () => {
  const { status } = await post({
    first_name: 'بوت',
    phone_number: `0502${Date.now().toString().slice(-6)}`,
    _gotcha: 'I am a bot',
  })
  assert(status === 400, `Expected 400 from honeypot, got ${status}`)
})

/* ── Summary ── */
console.log(`\n${'─'.repeat(42)}`)
console.log(`  Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log(`\n  ⚠️  Some tests failed. Check the server logs for details.\n`)
  process.exit(1)
} else {
  console.log(`\n  🎉  All tests passed! The API is ready for the funnel.\n`)
}
