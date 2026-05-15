/** Mirrors DB `normalize_lead_phone` for server-side lookups (submission API). */

export function normalizeLeadPhoneJs(p: string | null | undefined): string | null {
  if (p == null) return null
  const t = String(p).trim()
  if (!t || t === '-' || t === 'x') return null

  let s: string
  if (/e[+-]?\d/i.test(t)) {
    try {
      s = String(Math.floor(Number(t)))
    } catch {
      return null
    }
  } else {
    s = t.toLowerCase().replace(/[^0-9+]/g, '')
  }

  if (!s || s === '0') return null
  if (s.startsWith('966')) return s
  if (s.length === 9 && s.startsWith('5')) return '966' + s
  if (s.length === 10 && s.startsWith('05')) return '966' + s.slice(1)
  if (s.length === 12 && s.startsWith('9665')) return s
  return s
}
