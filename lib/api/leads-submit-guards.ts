import type { NextRequest } from 'next/server'

/** Default honeypot field names (leave empty in legitimate POSTs — bots often fill hidden inputs). */
const DEFAULT_HONEYPOT_KEYS = ['_trap', '_gotcha', 'company_website', 'fax', 'phone_extension', 'bots']

/** Best-effort client key for funnel rate limiting (trusted reverse proxy IPs help). */
export function funnelClientKey(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  const first = fwd?.split(',')[0]?.trim()
  if (first) return first.slice(0, 80)
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 80)
  return request.headers.get('cf-connecting-ip')?.trim().slice(0, 80) ?? 'unknown'
}

function honeypotFieldNames(): string[] {
  const raw = process.env.FUNNEL_HONEYPOT_FIELD_NAMES?.trim()
  const extras = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  return [...new Set([...DEFAULT_HONEYPOT_KEYS, ...extras])]
}

/**
 * Returns true when any configured honeypot field has a non-empty value.
 */
export function funnelHoneypotTriggered(body: Record<string, unknown>): boolean {
  const keys = honeypotFieldNames()
  for (const key of keys) {
    const found = Object.keys(body).find((k) => k.toLowerCase() === key.toLowerCase())
    if (!found) continue
    const v = body[found]
    if (v === undefined || v === null || v === false) continue
    if (typeof v === 'number' && v === 0) continue
    const s = String(v).trim()
    if (s !== '') return true
  }
  return false
}

const timestampsByKey = new Map<string, number[]>()

/**
 * Sliding-window limiter (per-instance memory). Suitable for moderate traffic;
 * horizontally scaled hosts should add edge/WAF limiting.
 */
export function funnelRateLimitExceeded(ipKey: string, maxPerMinute: number): boolean {
  if (maxPerMinute <= 0 || ipKey === 'unknown') return false

  const now = Date.now()
  const windowMs = 60_000
  const arr = (timestampsByKey.get(ipKey) ?? []).filter((t) => now - t < windowMs)

  if (arr.length >= maxPerMinute) {
    timestampsByKey.set(ipKey, arr)
    return true
  }

  arr.push(now)
  timestampsByKey.set(ipKey, arr)

  if (timestampsByKey.size > 12_000) timestampsByKey.clear()

  return false
}
