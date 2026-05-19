import Link from 'next/link'
import { Home, FileQuestion } from 'lucide-react'
import { RafBrand } from '@/components/brand/RafLogo'

export const metadata = {
  title: '404 — الصفحة غير موجودة | راف الوطنية',
}

export default function NotFound() {
  return (
    <div className="bg-navy-900 relative flex min-h-screen flex-col overflow-hidden text-white">
      {/* Grid background */}
      <svg
        className="pointer-events-none fixed inset-0 h-full w-full opacity-60"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <pattern id="nf-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M 56 0 L 0 0 0 56" fill="none" stroke="#14223A" strokeWidth="1" />
          </pattern>
          <pattern id="nf-grid-lg" width="280" height="280" patternUnits="userSpaceOnUse">
            <path d="M 280 0 L 0 0 0 280" fill="none" stroke="#1B2D4D" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#nf-grid)" />
        <rect width="100%" height="100%" fill="url(#nf-grid-lg)" />
      </svg>

      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(245,166,35,0.10) 0%, transparent 55%)',
        }}
      />

      {/* Header */}
      <header className="border-navy-700/50 relative z-10 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <RafBrand logoClassName="max-h-9" wordmarkTheme="light" />
          <Link
            href="/login"
            className="text-navy-200 hover:text-brand hidden items-center gap-2 text-sm transition-colors sm:flex"
          >
            تسجيل الدخول
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl space-y-8 text-center">
          <div className="relative">
            <div
              className="font-sans text-[140px] leading-none font-black tracking-tighter select-none md:text-[200px]"
              style={{
                background:
                  'linear-gradient(180deg, rgba(245,166,35,0.25) 0%, rgba(245,166,35,0.05) 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 60px rgba(245,166,35,0.15)',
              }}
            >
              404
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <div className="bg-brand/30 absolute inset-0 rounded-full blur-2xl" />
                <div className="from-brand to-brand-dark border-brand-light/30 relative flex h-20 w-20 rotate-6 items-center justify-center rounded-2xl border-2 bg-gradient-to-br shadow-2xl md:h-24 md:w-24">
                  <FileQuestion className="text-navy-900" size={44} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-white md:text-4xl">الصفحة غير موجودة</h1>
            <p className="text-navy-200 mx-auto max-w-md text-base leading-relaxed md:text-lg">
              عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها إلى موقع آخر.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/login"
              className="bg-brand hover:bg-brand-light text-navy-900 flex items-center gap-2 rounded-xl px-6 py-3 font-bold transition-colors"
            >
              <Home size={17} />
              الدخول إلى لوحة التحكم
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-navy-700/50 relative z-10 border-t py-5">
        <p className="text-navy-400 text-center text-xs">
          جميع الحقوق محفوظة لـ شركة راف الوطنية للتطوير والاستثمار العقاري
          <span className="mx-2">•</span>© 2026
        </p>
      </footer>
    </div>
  )
}
