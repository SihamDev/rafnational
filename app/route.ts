import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serves the RAF National landing page at `/` without changing the URL.
 * Using a route handler (instead of middleware rewrites or next.config rewrites)
 * because it is the most reliable approach on Vercel — no middleware dependency,
 * no rewrite chain, just a direct HTML response.
 */
export async function GET() {
  try {
    const html = readFileSync(
      join(process.cwd(), 'public', 'raf-national-landing.html'),
      'utf8',
    )
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    // Fallback if file is somehow missing during build
    return new Response(
      '<meta charset="utf-8"><p dir="rtl" style="padding:2rem;font-family:sans-serif">جاري التحميل…</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
}
