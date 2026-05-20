/**
 * CRM leads Excel import — Phase 1 (Sheet1) + Phase 2 (Qualified / Unqualified merges).
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-leads-xlsx.mjs --file ./import-data/leads.xlsx [--dry-run] [--phase 1|2|all]
 *
 * Optional:
 *   --sheet-sheet1 "Sheet1"
 *   --qualified    "Qualified"
 *   --unqualified  "Unqualified"
 *
 * Outputs (next to workbook): leads-import-<ts>-unmatched.json, leads-import-<ts>-conflicts.json
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

/* ─── env / args ──────────────────────────────────────────────────── */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const args = process.argv.slice(2)
const reqIdx = args.indexOf('--file')
const FILE_ARG = reqIdx !== -1 ? args[reqIdx + 1] : ''
const DRY_RUN = args.includes('--dry-run')
let PHASE = args.includes('--phase') ? (args[args.indexOf('--phase') + 1] ?? 'all') : 'all'
if (!['1', '2', 'all'].includes(PHASE)) PHASE = 'all'

function optStr(flagName, fallback) {
  const i = args.indexOf(flagName)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const SHEET_MAIN  = optStr('--sheet-sheet1', '')
const SHEET_QUAL  = optStr('--qualified',    '')
const SHEET_UNQUAL = optStr('--unqualified', '')

/** Same rules as funnel / CRM auto-qualify */
function autoQualifyRow(row) {
  const salary = String(row.salary_range_raw ?? '').trim()
  if (salary === '5000-7000' || salary === '8000-10000') return 'unqualified'
  const hold = row.has_service_hold
  if (hold === true || hold === 'نعم' || String(hold).toLowerCase() === 'yes') return 'unqualified'
  const mortgage = row.has_existing_mortgage
  if (mortgage === true || mortgage === 'نعم' || String(mortgage).toLowerCase() === 'yes') {
    return 'unqualified'
  }
  return 'qualified'
}

/** @type {unknown[]} */
const ART_UNMATCHED = []
/** @type {unknown[]} */
const ART_CONFLICTS = []

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!FILE_ARG || !fs.existsSync(FILE_ARG)) {
  console.error('Usage: node --env-file=.env.local scripts/import-leads-xlsx.mjs --file <path.xlsx>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const workbookDir = path.dirname(path.resolve(FILE_ARG))
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const OUT_UNMATCHED = path.join(workbookDir, `leads-import-${stamp}-unmatched.json`)
const OUT_CONFLICTS = path.join(workbookDir, `leads-import-${stamp}-conflicts.json`)

/* ─── Phone normalisation (mirrors public.normalize_lead_phone) ───── */
function normalizeLeadPhone(p) {
  if (p == null) return null
  let t = String(p).trim()
  if (!t || t === '-' || t.toLowerCase() === 'x') return null

  // scientific notation (e.g. 9.66e11)
  let s
  if (/e[+-]?\d/i.test(t)) {
    try { s = String(Math.round(Number(t))) } catch { return null }
  } else {
    s = t.replace(/[^0-9]/g, '')
  }
  if (!s || s === '0') return null

  if (s.startsWith('966') && s.length === 12) return s          // 966xxxxxxxxx
  if (s.startsWith('5')   && s.length === 9)  return '966' + s  // 5xxxxxxxx
  if (s.startsWith('05')  && s.length === 10) return '966' + s.slice(1) // 05xxxxxxxx
  if (s.startsWith('9665') && s.length === 12) return s
  return s.length >= 9 ? s : null  // keep but don't pad unknown formats
}

/* ─── Header normalisation ────────────────────────────────────────── */
function normHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_')
}

/* ─── Dirty-placeholder values ─────────────────────────────────────── */
// These are "please choose" default options leaked from the form — treat as null
const PLACEHOLDERS = new Set([
  'اختر الإجابة', 'اختر الراتب', 'اختر المدينة', 'اختر البنك',
  'اختر_الإجابة', 'اختر_الراتب', 'اختر_المدينة', 'اختر_البنك',
])

/* ─── Salary range canonical map ─────────────────────────────────── */
// Old form sent "15000-20000"; newer form sends "15,000 - 20,000" — unify to the comma form.
const SALARY_CANON = {
  '5000-7000':   '5,000 - 7,000',
  '8000-10000':  '8,000 - 10,000',
  '11000-15000': '11,000 - 15,000',
  '15000-20000': '15,000 - 20,000',
  '20000-30000': '20,000 - 30,000',
}
function normalizeSalary(v) {
  if (!v) return v
  const s = String(v).trim()
  const key = s.replace(/,/g, '').replace(/\s+/g, '')
  return SALARY_CANON[key] ?? s
}

/* ─── Column alias map ────────────────────────────────────────────── */
// Maps normalised-header strings → DB column names.
// Arabic column names come from the actual Excel headers (after normHeader).
const ALIAS_TO_DB = []
function alias(mapTo, synonyms) {
  for (const s of synonyms) ALIAS_TO_DB.push([normHeader(s), mapTo])
}

// Arabic column names (from leads.xlsx)
alias('first_name',            ['الإسم الأول',  'الاسم الاول',  'الإسم_الأول',  'first_name', 'firstname'])
alias('family_name',           ['الإسم العائلي','الاسم العائلي','الإسم_العائلي','family_name', 'lastname'])
alias('phone_number',          ['رقم الجوال',   'رقم_الجوال',   'الجوال', 'جوال', 'phone', 'mobile'])
alias('email',                 ['البريد الإلكتروني','البريد_الإلكتروني','البريد','بريد','email'])
alias('city',                  ['المدينة', 'مدينة', 'city'])
alias('has_existing_mortgage', ['هل عندك تمويل عقاري','هل_عندك_تمويل_عقاري','has_existing_mortgage'])
alias('bank_name',             ['البنك', 'بنك', 'bank_name'])
alias('salary_range_raw',      ['إجمالي الراتب', 'إجمالي_الراتب', 'الراتب', 'salary_range_raw', 'salary'])
alias('housing_support_raw',   ['هل لديك دعم سكن','هل_لديك_دعم_سكن','housing_support_raw'])
alias('employer_raw',          ['جهة العمل', 'جهة_العمل', 'employer_raw', 'employer'])
alias('requested_amount_raw',  ['المبلغ المطلوب','المبلغ_المطلوب','requested_amount_raw'])
alias('has_service_hold',      ['هل لديك ايقاف خدمات','هل_لديك_ايقاف_خدمات','هل لديك إيقاف خدمات','has_service_hold'])
alias('financing_need_raw',    ['مدى احتياج التمويل','مدى_احتياج_التمويل','financing_need_raw'])
alias('visit_source_raw',      ['مصدر الزيارة','مصدر_الزيارة','visit_source_raw','source'])
alias('campaign_raw',          ['الحملة', 'campaign_raw', 'campaign'])
alias('internal_notes',        ['ملاحظة', 'ملاحظات', 'internal_notes', 'notes'])
// Internal pseudo-fields (combined into funnel_submitted_at below)
alias('_raw_date',             ['التاريخ', 'date'])
alias('_raw_time',             ['الوقت',  'time'])
alias('_responsible',          ['المسؤول', 'responsible', 'agent'])

const ALIAS_MAP = Object.fromEntries(ALIAS_TO_DB)

/* ─── Cell coercion helpers ──────────────────────────────────────── */
function parseBoolMaybe(v) {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'boolean') return v
  const s = String(v).trim()
  if (/^(نعم|yes|true|1)$/i.test(s)) return true
  if (/^(لا|no|false|0)/i.test(s)) return false  // covers "لا، غير مستحق"
  return null
}

/** Convert Excel serial number to ISO timestamp string */
function excelSerialToISO(serial) {
  // Excel epoch: 1 Jan 1900, but with the Lotus-1-2-3 leap year bug (offset 25569 to Unix epoch)
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString()
}

/* ─── Row coercion ────────────────────────────────────────────────── */
function coerceRow(rawObj, sheetLabel, excelRowIdx) {
  const out = {
    import_source_sheet:          sheetLabel,
    merged_from_qualified_row:    null,
    merged_from_unqualified_row:  null,
  }

  for (const [k, cell] of Object.entries(rawObj)) {
    const nk = normHeader(k)
    const dbField = ALIAS_MAP[nk] ?? null
    if (!dbField) continue

    // Clean placeholder "please choose" values
    if (typeof cell === 'string' && PLACEHOLDERS.has(cell.trim())) {
      out[dbField] = null
      continue
    }
    // Skip the automation template leak from Make/Zapier
    if (typeof cell === 'string' && cell.includes('{{') && cell.includes('}}')) {
      out[dbField] = null
      continue
    }

    if (dbField === 'has_existing_mortgage' || dbField === 'has_service_hold') {
      out[dbField] = parseBoolMaybe(cell)
    } else if (dbField === 'salary_range_raw') {
      const raw = typeof cell === 'string' ? cell.trim() : String(cell ?? '').trim()
      out[dbField] = raw === '' ? null : normalizeSalary(raw)
    } else if (dbField === '_raw_date' || dbField === '_raw_time') {
      out[dbField] = typeof cell === 'number' ? cell : null
    } else if (typeof cell === 'string') {
      out[dbField] = cell.trim() === '' ? null : cell.trim()
    } else if (typeof cell === 'number' || typeof cell === 'boolean') {
      out[dbField] = cell
    } else if (cell instanceof Date) {
      if (dbField.endsWith('_at')) out[dbField] = cell.toISOString()
      else out[dbField] = cell
    } else {
      out[dbField] = cell ?? null
    }
  }

  // Combine _raw_date + _raw_time → funnel_submitted_at
  if (!out.funnel_submitted_at) {
    const d = typeof out._raw_date === 'number' ? out._raw_date : 0
    const t = typeof out._raw_time === 'number' ? out._raw_time : 0
    if (d > 0) out.funnel_submitted_at = excelSerialToISO(d + t)
  }
  delete out._raw_date
  delete out._raw_time

  // _responsible: store in internal_notes (can't resolve to UUID automatically)
  if (out._responsible) {
    const agent = String(out._responsible).trim()
    if (agent) {
      const tag = `[import-agent: ${agent}]`
      out.internal_notes = out.internal_notes ? `${out.internal_notes}\n${tag}` : tag
    }
  }
  delete out._responsible

  // Normalise phone
  if (out.phone_number != null) {
    out.phone_normalized = normalizeLeadPhone(out.phone_number)
  }

  const err = !out.first_name
    ? `[row ${excelRowIdx}] Missing first_name in sheet "${sheetLabel}"`
    : ''

  if (sheetLabel === 'qualified')   out.merged_from_qualified_row   = excelRowIdx
  if (sheetLabel === 'unqualified') out.merged_from_unqualified_row = excelRowIdx

  return { row: out, err }
}

/* ─── Sheet → object array ─────────────────────────────────────────── */
function sheetToObjects(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  if (!rows.length) return []
  const header = rows[0].map(normHeader)
  const data = []
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]
    if (!line || !line.some((c) => c !== null && String(c ?? '').trim() !== '')) continue
    const obj = {}
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = line[c]
    }
    data.push(obj)
  }
  return data
}

/* ─── Utility helpers ──────────────────────────────────────────────── */
function mergeNotes(existingNotes, snippet) {
  const base = (existingNotes ?? '').trim()
  const line = `[import ${stamp}] ${snippet}`
  return base ? `${base}\n${line}` : line
}

function conflictsForMerge(base, supplemental) {
  const bits = []
  const keys = ['first_name', 'family_name', 'email', 'phone_number', 'city']
  for (const k of keys) {
    const a = base[k]
    const b = supplemental[k]
    if (a != null && b != null && String(a).trim() !== String(b).trim()) {
      bits.push(`${k}: db="${a}" sheet="${b}"`)
    }
  }
  return bits.join('; ')
}

function pickSheetName(book, hint, fallbackFirst) {
  const h = (hint ?? '').trim()
  if (!h) return fallbackFirst ? book.SheetNames[0] : null
  if (book.SheetNames.includes(h)) return h
  const low = h.toLowerCase()
  const found = book.SheetNames.find((n) => n.toLowerCase() === low)
  if (found) return found
  const partial = book.SheetNames.find((n) => n.toLowerCase().includes(low))
  return partial ?? null
}

function inferMergedSheet(book, qualification) {
  const names = book.SheetNames
  if (qualification === 'qualified') {
    return (
      names.find((n) => {
        const l = n.toLowerCase()
        return l.includes('qualified') && !l.includes('unqualified')
      }) ?? null
    )
  }
  return names.find((n) => n.toLowerCase().includes('unqualified')) ?? null
}

/* ─── Lead index (for phase 2 lookups) ───────────────────────────── */
async function loadLeadIndex() {
  const byPhone = new Map()
  const byEmail = new Map()
  const byName  = new Map()

  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('leads')
      .select(
        'id,first_name,family_name,phone_number,phone_normalized,email,qualification_status,import_conflict_notes,city,bank_name,visit_source_raw,campaign_raw,employer_raw,requested_amount_raw,internal_notes',
      )
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const chunk = data ?? []
    for (const row of chunk) {
      if (row.phone_normalized) byPhone.set(row.phone_normalized, row)
      const em = row.email ? String(row.email).toLowerCase().trim() : ''
      if (em) byEmail.set(em, row)
      const fn  = String(row.first_name  ?? '').trim().toLowerCase()
      const fam = String(row.family_name ?? '').trim().toLowerCase()
      if (fn) byName.set(`${fn}|${fam}`, row)
    }
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return { byPhone, byEmail, byName }
}

function matchLead(parsed, maps) {
  const pn = normalizeLeadPhone(parsed.phone_number)
  if (pn && maps.byPhone.has(pn)) return { lead: maps.byPhone.get(pn), method: 'phone' }
  const em = parsed.email ? String(parsed.email).toLowerCase().trim() : ''
  if (em && maps.byEmail.has(em)) return { lead: maps.byEmail.get(em), method: 'email' }
  const fn  = String(parsed.first_name  ?? '').trim().toLowerCase()
  const fam = String(parsed.family_name ?? '').trim().toLowerCase()
  const nk  = `${fn}|${fam}`
  if (nk !== '|' && maps.byName.has(nk)) return { lead: maps.byName.get(nk), method: 'name' }
  return { lead: null, method: null }
}

/* ─── Phase 1: insert Sheet1 ─────────────────────────────────────── */
async function phase1(book) {
  const mainName = SHEET_MAIN.trim()
    ? pickSheetName(book, SHEET_MAIN, false) ?? pickSheetName(book, '', true)
    : pickSheetName(book, '', true)

  if (!mainName) { console.error('Phase 1: workbook has no sheets'); return }

  const ws      = book.Sheets[mainName]
  const rawObjs = sheetToObjects(ws)

  const toInsert = []
  const parseErrors = []

  for (let i = 0; i < rawObjs.length; i++) {
    const { row, err } = coerceRow(rawObjs[i], 'sheet1', i + 2)
    if (err) { parseErrors.push(err); continue }
    row.qualification_status  = autoQualifyRow(row)
    row.sales_workflow_status = 'new'
    toInsert.push(row)
  }

  if (parseErrors.length) ART_UNMATCHED.push({ phase: 1, sheet: mainName, parseErrors })

  if (DRY_RUN) {
    console.log(`Phase 1 (${mainName}) DRY-RUN: ${toInsert.length} rows would be inserted, ${parseErrors.length} skipped`)
    return
  }

  // Load existing phone_normalized from DB so we can skip already-imported leads.
  process.stdout.write('  Phase 1: loading existing leads...\r')
  const existingPhones = new Set()
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('leads')
      .select('phone_normalized')
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('\n  failed to load existing leads:', error.message)
      break
    }
    const chunk = data ?? []
    for (const row of chunk) {
      if (row.phone_normalized) existingPhones.add(row.phone_normalized)
    }
    if (chunk.length < PAGE) break
    from += PAGE
  }
  console.log(`  Phase 1: existing leads in DB = ${existingPhones.size}                 `)

  // Dedupe within the import batch + skip duplicates already in DB.
  const seenInBatch = new Set()
  const filtered = []
  let skippedDup = 0
  for (const r of toInsert) {
    const pn = r.phone_normalized
    if (pn) {
      if (existingPhones.has(pn) || seenInBatch.has(pn)) {
        skippedDup++
        continue
      }
      seenInBatch.add(pn)
    }
    filtered.push(r)
  }

  // Plain insert (no onConflict needed since duplicates are filtered out).
  const BATCH = 200
  let inserted = 0
  const batchErrors = []

  for (let i = 0; i < filtered.length; i += BATCH) {
    const batch = filtered.slice(i, i + BATCH)
    const { error, count } = await supabase
      .from('leads')
      .insert(batch, { count: 'exact' })
    if (error) {
      batchErrors.push(`batch ${i / BATCH + 1}: ${error.message}`)
    } else {
      inserted += count ?? batch.length
    }
    process.stdout.write(`  Phase 1 progress: ${Math.min(i + BATCH, filtered.length)}/${filtered.length}\r`)
  }

  if (batchErrors.length) ART_UNMATCHED.push({ phase: 1, sheet: mainName, batchErrors })
  console.log(
    `\nPhase 1 (${mainName}): ${inserted} inserted, ${skippedDup} skipped (duplicate phone), ` +
      `${parseErrors.length} parse-skipped, ${batchErrors.length} batch-errors`,
  )
}

/* ─── Phase 2: merge Qualified / Unqualified ─────────────────────── */
async function phaseMerge(book, sheetHint, qualification) {
  let namePick = sheetHint.trim() ? pickSheetName(book, sheetHint, false) : null
  if (!namePick) namePick = inferMergedSheet(book, qualification)

  if (!namePick) {
    console.warn(`Phase 2: could not resolve ${qualification} sheet — skipping`)
    return
  }

  const ws      = book.Sheets[namePick]
  const rawObjs = sheetToObjects(ws)
  const maps    = await loadLeadIndex()
  const unmatched = []
  const conflicts = []

  const updates = []   // { id, patch }

  for (let i = 0; i < rawObjs.length; i++) {
    const excelRowIdx = i + 2
    const label = qualification === 'qualified' ? 'qualified' : 'unqualified'
    const { row: parsedRaw, err } = coerceRow(rawObjs[i], label, excelRowIdx)
    if (err) {
      unmatched.push({ excelRow: excelRowIdx, reason: err, sheet: namePick })
      continue
    }

    const { lead, method } = matchLead(parsedRaw, maps)
    if (!lead) {
      unmatched.push({
        excelRow:  excelRowIdx,
        sheet:     namePick,
        reason:    'no_phone_email_name_match',
        phone:     parsedRaw.phone_number ?? null,
        email:     parsedRaw.email        ?? null,
        name:      `${parsedRaw.first_name ?? ''} ${parsedRaw.family_name ?? ''}`.trim(),
      })
      continue
    }

    const ctext = conflictsForMerge(lead, parsedRaw)
    if (ctext) conflicts.push({ leadId: lead.id, excelRow: excelRowIdx, details: ctext })

    const patch = { qualification_status: qualification }
    if (ctext) patch.import_conflict_notes = mergeNotes(lead.import_conflict_notes, ctext)

    if (qualification === 'qualified')   patch.merged_from_qualified_row   = excelRowIdx
    else                                 patch.merged_from_unqualified_row  = excelRowIdx

    // Copy internal_notes from Qualified sheet if present
    if (parsedRaw.internal_notes) {
      const existing = (lead.internal_notes ?? '').trim()
      patch.internal_notes = existing
        ? `${existing}\n${parsedRaw.internal_notes}`
        : parsedRaw.internal_notes
    }

    // Enrich empty fields from the qualified/unqualified sheet
    const enrichKeys = ['city','bank_name','visit_source_raw','campaign_raw','employer_raw','requested_amount_raw']
    for (const k of enrichKeys) {
      if ((lead[k] == null || String(lead[k]).trim() === '') && parsedRaw[k]) {
        patch[k] = parsedRaw[k]
      }
    }

    updates.push({ id: lead.id, patch })
    maps.byPhone.set(lead.phone_normalized, { ...lead, ...patch })
  }

  if (!DRY_RUN) {
    // Run updates in parallel chunks for ~10x speedup over sequential one-by-one.
    const CONCURRENCY = 20
    let done = 0
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const chunk = updates.slice(i, i + CONCURRENCY)
      const results = await Promise.all(
        chunk.map(({ id, patch }) =>
          supabase.from('leads').update(patch).eq('id', id).then((res) => ({ id, res })),
        ),
      )
      for (const { id, res } of results) {
        if (res.error) unmatched.push({ leadId: id, reason: res.error.message })
        else done++
      }
      process.stdout.write(`  Phase 2 ${qualification}: ${done}/${updates.length}\r`)
    }
    console.log(`\nPhase 2 ${qualification} (${namePick}): ${done} merged, ${unmatched.length} unmatched, ${conflicts.length} conflicts`)
  } else {
    console.log(`Phase 2 ${qualification} (${namePick}) DRY-RUN: ${updates.length} would merge, ${unmatched.length} unmatched`)
  }

  if (unmatched.length) ART_UNMATCHED.push({ phase: 2, qualification, sheet: namePick, unmatched })
  if (conflicts.length) ART_CONFLICTS.push({ phase: 2, qualification, sheet: namePick, conflicts })
}

/* ─── Entry point ──────────────────────────────────────────────────── */
async function main() {
  console.log(`\n📥  RAF National — leads import`)
  console.log(`    file:    ${FILE_ARG}`)
  console.log(`    phase:   ${PHASE}`)
  console.log(`    dry-run: ${DRY_RUN}\n`)

  const buf  = fs.readFileSync(FILE_ARG)
  const book = XLSX.read(buf, { type: 'buffer' })
  console.log(`    sheets:  ${book.SheetNames.join(', ')}\n`)

  if (PHASE === '1' || PHASE === 'all') await phase1(book)
  if (PHASE === '2' || PHASE === 'all') {
    await phaseMerge(book, SHEET_QUAL,   'qualified')
    await phaseMerge(book, SHEET_UNQUAL, 'unqualified')
  }

  if (ART_UNMATCHED.length) {
    fs.writeFileSync(OUT_UNMATCHED, JSON.stringify(ART_UNMATCHED, null, 2), 'utf8')
    console.log(`\n⚠   Unmatched log → ${OUT_UNMATCHED}`)
  }
  if (ART_CONFLICTS.length) {
    fs.writeFileSync(OUT_CONFLICTS, JSON.stringify(ART_CONFLICTS, null, 2), 'utf8')
    console.log(`⚠   Conflicts log  → ${OUT_CONFLICTS}`)
  }

  console.log('\n✅  Import complete.')
}

main().catch((e) => { console.error(e); process.exit(1) })
