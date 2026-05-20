import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { safeInternalNext } from '@/lib/safe-next-path'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Role check is handled by the layout via getAdminUser() (React.cache-deduped).
    // Removing the extra profiles query here saves one DB round-trip per admin request.
  }

  if (pathname === '/login' && user) {
    const next = safeInternalNext(request.nextUrl.searchParams.get('redirect'))
    if (next) return NextResponse.redirect(new URL(next, request.url))
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // Home: guests → login, staff → admin
  if (pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Funnel landing — static page at /funnel1 (URL stays /funnel1)
  if (pathname === '/funnel1' || pathname === '/funnel1/') {
    const url = request.nextUrl.clone()
    url.pathname = '/funnel1/index.html'
    const rewriteRes = NextResponse.rewrite(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
      rewriteRes.cookies.set(name, value)
    })
    return rewriteRes
  }

  return supabaseResponse
}
