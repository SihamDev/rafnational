import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  /* ── Root path `/` → serve landing page for guests ── */
  if (pathname === '/') {
    if (supabaseUrl.startsWith('http')) {
      try {
        return await updateSession(request)
      } catch {
        // Supabase unreachable — still show landing page below
      }
    }
    const url = request.nextUrl.clone()
    url.pathname = '/raf-national-landing.html'
    return NextResponse.rewrite(url)
  }

  /* ── All other paths: normal auth middleware ── */
  if (!supabaseUrl.startsWith('http')) {
    return NextResponse.next({ request })
  }
  try {
    return await updateSession(request)
  } catch {
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)',
  ],
}
