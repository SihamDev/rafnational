/** Allows same-origin relative paths only (no open redirects). */
export function safeInternalNext(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s.startsWith('/') || s.startsWith('//')) return null
  if (s.includes('://') || s.includes('@')) return null
  return s
}
