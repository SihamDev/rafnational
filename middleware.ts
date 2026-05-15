import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  /* ── Root path: serve landing page (rewrite keeps URL as `/`) ── */
  if (pathname === '/') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

    // If Supabase is configured, check if the user is already logged in
    // so we can redirect them straight to /admin.
    if (supabaseUrl.startsWith('http')) {
      try {
        return await updateSession(request)
      } catch {
        // Supabase unreachable — fall through and still show landing page
      }
    }

    // No Supabase env or error: unconditionally rewrite to landing page
    const url = request.nextUrl.clone()
    url.pathname = '/raf-national-landing.html'
    return NextResponse.rewrite(url)
  }

  /* ── All other paths: normal Supabase auth middleware ── */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
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
