import { NextRequest, NextResponse } from 'next/server'

import {
  funnelClientKey,
  funnelHoneypotTriggered,
  funnelRateLimitExceeded,
} from '@/lib/api/leads-submit-guards'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { mapInboundFunnelJson } from '@/lib/leads/map-funnel-payload'
import { normalizeLeadPhoneJs } from '@/lib/leads/normalize-phone'
import { funnelLeadSubmitSchema } from '@/lib/validations/leads'

function funnelMaxPerMinute(): number {
  const n = Number(process.env.FUNNEL_RATE_LIMIT_PER_MINUTE ?? '40')
  if (!Number.isFinite(n)) return 40
  return Math.min(500, Math.max(0, Math.floor(n)))
}

function corsHeaders(request: NextRequest): HeadersInit {
  const origins = process.env.FUNNEL_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean)

  const origin = request.headers.get('origin')
  let allowOrigin = '*'
  if (origins?.length) {
    if (origin && origins.includes(origin)) allowOrigin = origin
    else allowOrigin = '' /* browser will block cross-site if missing */
  } else if (origin) {
    allowOrigin = origin
  }

  const base: HeadersInit =
    allowOrigin === ''
      ? {
          Vary: 'Origin',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-Funnel-Secret, X-Funnel-Vendor',
          'Access-Control-Max-Age': '86400',
        }
      : {
          'Access-Control-Allow-Origin': allowOrigin,
          Vary: 'Origin',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-Funnel-Secret, X-Funnel-Vendor',
          'Access-Control-Max-Age': '86400',
        }

  return base
}

function extractSubmittedAtIso(raw: Record<string, unknown>): string | null {
  for (const k of ['date', 'submitted_at', 'submittedAt', 'timestamp'] as const) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) {
      const ms = Date.parse(v.trim())
      if (!Number.isNaN(ms)) return new Date(ms).toISOString()
    }
  }
  return null
}

function buildFunnelTimestamp(body: {
  submitted_date?: string | null
  submitted_time?: string | null
}): string {
  if (body.submitted_date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const t = body.submitted_time?.trim()
    const timePart =
      t && /^\d{1,2}:\d{2}(:\d{2})?$/.test(t) ? t : '12:00:00'

    /* Treat as Arabia Standard Time without DST */
    const iso = `${body.submitted_date}T${timePart}+03:00`
    const ms = Date.parse(iso)
    if (!Number.isNaN(ms)) return new Date(ms).toISOString()
  }

  return new Date().toISOString()
}

/* ──────────────────────────────────────────────────────────────
   Auto-qualification rules (Saudi mortgage financing standards)
   ────────────────────────────────────────────────────────────── */
function parseNumber(v: unknown): number | null {
  if (v === undefined || v === null) return null
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function autoQualify(body: Record<string, unknown>): 'qualified' | 'unqualified' {
  const salary     = parseNumber(body.salary_numeric ?? body.salary_range_raw)
  const obligation = parseNumber(body.obligation_numeric ?? body.requested_amount_raw)

  // No salary provided → unqualified (form requires salary so this is a bad submission)
  if (salary === null) return 'unqualified'

  // Rule 1: minimum salary 4,000 SAR
  if (salary < 4000) return 'unqualified'

  // Rule 2: debt-burden ratio — total monthly obligations ≤ 45% of salary
  if (obligation !== null && obligation / salary > 0.45) return 'unqualified'

  return 'qualified'
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.FUNNEL_SUBMIT_SECRET?.trim()
    if (!expected) {
      console.error('FUNNEL_SUBMIT_SECRET missing')
      return NextResponse.json(
        { ok: false, error: 'تعذّر استلام الطلب' },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const auth =
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
        ?? request.headers.get('x-funnel-secret')

    if (auth !== expected) {
      return NextResponse.json({ ok: false, error: 'غير مصرح' }, {
        status: 401,
        headers: corsHeaders(request),
      })
    }

    const json = await request.json()
    const body = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}

    if (funnelHoneypotTriggered(body)) {
      return NextResponse.json(
        { ok: false, error: 'تعذّر معالجة الطلب' },
        { status: 400, headers: corsHeaders(request) },
      )
    }

    const maxPerMin = funnelMaxPerMinute()
    if (maxPerMin > 0 && funnelRateLimitExceeded(funnelClientKey(request), maxPerMin)) {
      const retryHeaders = new Headers(corsHeaders(request))
      retryHeaders.set('Retry-After', '60')
      return NextResponse.json(
        { ok: false, error: 'طلبات كثيرة، حاول بعد قليل' },
        { status: 429, headers: retryHeaders },
      )
    }

    const submittedAtFromClient = extractSubmittedAtIso(body)

    const mapped = mapInboundFunnelJson(body)
    const parsed = funnelLeadSubmitSchema.safeParse(mapped)

    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('؛ ')
      return NextResponse.json(
        { ok: false, error: msg },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const b = parsed.data

    let emailClean: string | null =
      typeof b.email === 'string' && b.email.includes('@')
        ? b.email.trim().toLowerCase()
        : null

    const supabase = createServiceRoleClient()

    const phoneNorm = normalizeLeadPhoneJs(b.phone_number.trim())
    let duplicateId: string | null = null
    if (phoneNorm) {
      const { data: dup } = await supabase
        .from('leads')
        .select('id')
        .eq('phone_normalized', phoneNorm)
        .maybeSingle()
      const dupRow = dup as { id?: string } | null
      duplicateId = dupRow?.id ?? null
    }
    if (!duplicateId && emailClean) {
      const { data: dupE } = await supabase
        .from('leads')
        .select('id')
        .eq('email', emailClean)
        .maybeSingle()
      const dupRow = dupE as { id?: string } | null
      duplicateId = dupRow?.id ?? null
    }

    if (duplicateId) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true as const,
          /** Same shape legacy n8n / ClickFunnels scripts expect */
          status: 'duplicate' as const,
          id: duplicateId,
        },
        { status: 200, headers: corsHeaders(request) },
      )
    }

    const submittedAt = submittedAtFromClient ?? buildFunnelTimestamp(b)

    /* ── Auto-qualification based on salary & obligations ── */
    const autoQual = autoQualify(body)

    const { data: row, error } = await supabase
      .from('leads')
      .insert({
        first_name: b.first_name,
        family_name: b.family_name?.trim() ?? null,
        phone_number: b.phone_number.trim(),
        email: emailClean,
        city: b.city?.trim() ?? null,
        has_existing_mortgage: b.has_existing_mortgage ?? null,
        bank_name: b.bank_name?.trim() ?? null,
        salary_range_raw: b.salary_range_raw?.trim() ?? null,
        housing_support_raw: b.housing_support_raw?.trim() ?? null,
        employer_raw: b.employer_raw?.trim() ?? null,
        requested_amount_raw: b.requested_amount_raw?.trim() ?? null,
        has_service_hold: b.has_service_hold ?? null,
        financing_need_raw: b.financing_need_raw?.trim() ?? null,
        visit_source_raw: b.visit_source_raw?.trim() ?? null,
        campaign_raw: b.campaign_raw?.trim() ?? null,
        funnel_submitted_at: submittedAt,
        qualification_status: autoQual,
        sales_workflow_status: 'new',
        import_source_sheet: null,
      } as Record<string, unknown>)
      .select('id')
      .single()

    if (error) {
      console.error('lead insert:', error.message)
      return NextResponse.json(
        { ok: false, error: 'تعذّر الحفظ' },
        { status: 502, headers: corsHeaders(request) }
      )
    }

    return NextResponse.json(
      { ok: true, status: 'created' as const, id: row?.id ?? null },
      {
        status: 201,
        headers: corsHeaders(request),
      },
    )
  } catch (e) {
    console.error('leads/submit:', e)
    return NextResponse.json(
      { ok: false, error: 'خطأ بالخادم' },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
