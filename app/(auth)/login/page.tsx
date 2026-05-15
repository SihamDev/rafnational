'use client'

import { Suspense, useState, useTransition, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Mail, Lock, ArrowLeft, ChevronLeft, ShieldCheck, BadgeCheck } from 'lucide-react'
import { toast } from 'sonner'

import { signIn, forgotPassword } from '@/lib/actions/auth'
import { loginSchema, forgotPasswordSchema } from '@/lib/validations/auth'
import type { LoginInput, ForgotPasswordInput } from '@/lib/validations/auth'

type Panel = 'login' | 'forgot'

const fieldCls =
  'w-full rounded-2xl border border-white/[0.1] bg-white/[0.05] py-3.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-navy-400 backdrop-blur-sm transition-[border-color,box-shadow] duration-200 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/20'

const cardShellCls =
  'rounded-[2rem] border border-white/[0.12] bg-gradient-to-br from-white/[0.09] via-navy-900/55 to-navy-950/80 p-[1px] shadow-[0_32px_100px_-24px_rgba(0,0,0,0.75)] backdrop-blur-2xl'

const cardInnerCls =
  'relative space-y-6 rounded-[1.85rem] bg-navy-950/75 px-8 py-9 ring-1 ring-white/[0.06]'

/* ─── RAF National inline SVG logo mark ─── */
function RafLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Hexagonal background */}
      <path
        d="M24 3L42 13.5V34.5L24 45L6 34.5V13.5L24 3Z"
        fill="url(#rafGrad)"
        stroke="#F5A623"
        strokeWidth="1"
        strokeOpacity="0.4"
      />
      {/* Inner glow ring */}
      <path
        d="M24 8L38 16V32L24 40L10 32V16L24 8Z"
        fill="none"
        stroke="#F5A623"
        strokeWidth="0.6"
        strokeOpacity="0.25"
      />
      {/* Stylised "R" lettermark */}
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fontFamily="'El Messiri', serif"
        fill="#F5A623"
        letterSpacing="-0.5"
      >
        ر
      </text>
      <defs>
        <linearGradient id="rafGrad" x1="6" y1="3" x2="42" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#14223A" />
          <stop offset="100%" stopColor="#0A1424" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/* ─── Full brand header ─── */
function RafBrandFull({ size = 52 }: { size?: number }) {
  return (
    <div className="flex items-center gap-4">
      <RafLogo size={size} />
      <div className="flex flex-col leading-tight">
        <span
          className="font-heading font-bold text-white"
          style={{ fontSize: size * 0.42 }}
        >
          راف الوطنية
        </span>
        <span
          className="text-brand font-heading font-semibold tracking-widest uppercase"
          style={{ fontSize: size * 0.22 }}
        >
          RAF NATIONAL
        </span>
      </div>
    </div>
  )
}

function LoginPageInner() {
  const searchParams = useSearchParams()
  const redirectAfterLogin = searchParams.get('redirect')

  useEffect(() => {
    if (searchParams.get('error') === 'no_access') {
      toast.error('ليس لديك صلاحية الوصول إلى لوحة التحكم')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [panel, setPanel] = useState<Panel>('login')
  const [showPw, setShowPw] = useState(false)
  const [isPending, startTransition] = useTransition()

  const loginForm = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })
  const forgotForm = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  function onLogin(data: LoginInput) {
    startTransition(async () => {
      const res = await signIn(data.email, data.password, redirectAfterLogin)
      if (res?.error) toast.error(res.error)
    })
  }

  function onForgot(data: ForgotPasswordInput) {
    startTransition(async () => {
      const res = await forgotPassword(data.email)
      if (res?.error) toast.error(res.error)
      if (res?.success) {
        toast.success(res.success)
        setPanel('login')
      }
    })
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden md:flex-row" dir="rtl">
      {/* ── Ambient background ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_140%_90%_at_80%_-10%,rgba(245,166,35,0.10),transparent_50%),radial-gradient(ellipse_80%_70%_at_10%_110%,rgba(26,55,96,0.55),transparent_55%),linear-gradient(160deg,#0c1828_0%,#050a14_100%)]" />

      {/* ── Left visual panel (RTL: right side visually) ── */}
      <aside className="relative z-[1] hidden min-h-[100dvh] w-full flex-none flex-col justify-between overflow-hidden px-11 py-12 md:flex md:max-w-[52%] md:py-14">
        {/* Grid overlay — blueprint feel */}
        <div
          className="absolute inset-0 opacity-[0.22]"
          aria-hidden
          style={{
            backgroundImage: `
              linear-gradient(rgba(245,166,35,0.18) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245,166,35,0.18) 1px, transparent 1px),
              linear-gradient(rgba(20,34,58,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(20,34,58,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '200px 200px, 200px 200px, 40px 40px, 40px 40px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute -start-[20%] -top-[30%] h-[70vmin] w-[70vmin] rounded-full bg-brand/[0.07] blur-[110px]" />
        <div className="absolute end-0 bottom-[10%] h-[42vmin] w-[42vmin] rounded-full bg-navy-600/30 blur-[90px]" />

        {/* City skyline silhouette */}
        <svg
          className="pointer-events-none absolute bottom-0 start-0 end-0 w-full"
          viewBox="0 0 800 280"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden
        >
          <defs>
            <linearGradient id="skyFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5A623" stopOpacity="0.13" />
              <stop offset="100%" stopColor="#F5A623" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="skyLine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5A623" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#F5A623" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Building group — filled silhouette */}
          <g fill="url(#skyFade)">
            {/* Far left tower */}
            <rect x="0" y="140" width="55" height="140" />
            <rect x="18" y="100" width="20" height="40" />
            {/* Antenna */}
            <rect x="26" y="78" width="4" height="22" />

            {/* Short block */}
            <rect x="55" y="195" width="70" height="85" />
            <rect x="65" y="175" width="45" height="20" />

            {/* Tall central skyscraper */}
            <rect x="130" y="50" width="70" height="230" />
            <rect x="145" y="30" width="40" height="20" />
            <rect x="162" y="10" width="6" height="20" />

            {/* Mid tower */}
            <rect x="205" y="95" width="55" height="185" />
            <rect x="215" y="75" width="35" height="20" />

            {/* Small block */}
            <rect x="265" y="185" width="50" height="95" />

            {/* Wide low building */}
            <rect x="320" y="155" width="110" height="125" />
            <rect x="350" y="130" width="55" height="25" />

            {/* Secondary tower */}
            <rect x="435" y="75" width="60" height="205" />
            <rect x="448" y="55" width="34" height="20" />
            <rect x="463" y="38" width="4" height="17" />

            {/* Low right block */}
            <rect x="500" y="190" width="80" height="90" />
            <rect x="515" y="165" width="50" height="25" />

            {/* Far right tower */}
            <rect x="585" y="110" width="65" height="170" />
            <rect x="598" y="88" width="40" height="22" />

            {/* Edge fill */}
            <rect x="655" y="170" width="145" height="110" />
            <rect x="680" y="148" width="60" height="22" />
          </g>

          {/* Roofline glow stroke */}
          <polyline
            points="0,140 55,140 55,195 125,195 125,185 130,185 130,50 200,50 205,95 260,95 265,185 315,185 320,155 370,130 425,130 430,155 435,75 495,75 500,190 580,190 585,110 650,110 655,170 800,170"
            fill="none"
            stroke="url(#skyLine)"
            strokeWidth="1.5"
          />

          {/* Window grid on tall tower */}
          <g fill="#F5A623" fillOpacity="0.12">
            {[0,1,2,3,4,5,6,7,8].map(row =>
              [0,1,2].map(col => (
                <rect key={`w-${row}-${col}`} x={140 + col * 18} y={60 + row * 22} width="10" height="14" rx="1" />
              ))
            )}
          </g>
          {/* Window grid on secondary tower */}
          <g fill="#F5A623" fillOpacity="0.10">
            {[0,1,2,3,4,5].map(row =>
              [0,1].map(col => (
                <rect key={`w2-${row}-${col}`} x={442 + col * 18} y={85 + row * 22} width="10" height="13" rx="1" />
              ))
            )}
          </g>
        </svg>

        {/* Content */}
        <header className="relative z-[1] flex flex-col gap-12">
          <RafBrandFull size={64} />

          <div className="max-w-xl space-y-8">
            <div className="inline-flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-light">
                <BadgeCheck size={13} />
                جلسة آمنة ومشفّرة
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-500/40 bg-black/25 px-3 py-1 text-[11px] font-medium tracking-wide text-navy-100">
                <ShieldCheck size={13} className="text-brand" />
                بيانات سرّية 100%
              </span>
            </div>

            <div className="space-y-4">
              <p className="font-heading text-[0.72rem] font-bold tracking-[0.38em] uppercase text-brand-light">
                منصة عملاء التمويل العقاري
              </p>
              <h2 className="font-heading text-4xl font-bold leading-[1.14] text-white lg:text-[2.65rem]">
                حوّل عملاءك إلى
                <span className="px-2 text-brand">صفقات ناجحة</span>
                مع راف الوطنية.
              </h2>
              <p className="max-w-[28rem] font-heading text-base leading-relaxed text-navy-100/90">
                منصة متكاملة لإدارة عملاء التمويل العقاري — من أول تسجيل في الفانيل حتى إغلاق الصفقة. تابع الأهلية، وزّع العملاء، وراقب أداء الفريق.
              </p>
            </div>
          </div>
        </header>

        {/* Feature pills at bottom */}
        <div className="relative z-[1] mt-auto flex flex-wrap items-end justify-between gap-6 pt-16">
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'CRM العملاء', color: 'bg-brand/15 text-brand border-brand/20' },
              { label: 'التمويل العقاري', color: 'bg-navy-600/30 text-navy-100 border-navy-500/30' },
              { label: 'تقارير المبيعات', color: 'bg-navy-600/30 text-navy-100 border-navy-500/30' },
            ].map((f) => (
              <span
                key={f.label}
                className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold ${f.color}`}
              >
                {f.label}
              </span>
            ))}
          </div>
          <p className="max-w-[12rem] text-end text-[11px] leading-relaxed text-navy-400">
            راف الوطنية · التطوير والاستثمار العقاري
          </p>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="relative z-[1] flex min-h-[100dvh] flex-1 flex-col justify-center px-5 py-12 sm:px-8 lg:px-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute top-[-15%] end-[-8%] h-[min(60vw,22rem)] w-[min(60vw,22rem)] rounded-full bg-brand/12 blur-[90px]" />
          <div className="absolute bottom-[-25%] start-[-20%] h-[min(120vw,32rem)] w-[min(120vw,32rem)] rounded-full bg-[#1a3760]/50 blur-[100px]" />
        </div>

        <div className="relative mx-auto w-full max-w-[440px]">
          {/* Mobile brand */}
          <div className="mb-10 flex items-center justify-center md:hidden">
            <RafBrandFull size={48} />
          </div>

          {/* ══ LOGIN PANEL ══ */}
          {panel === 'login' && (
            <div className={cardShellCls}>
              <div className={cardInnerCls}>
                <div className="absolute -end-24 -top-24 h-48 w-48 rounded-full bg-brand/20 blur-[60px]" aria-hidden />

                <div className="relative space-y-1">
                  <div className="mb-5 inline-flex flex-col gap-1">
                    <span className="font-heading text-[0.62rem] font-bold tracking-[0.32em] uppercase text-brand-light">
                      تسجيل الدخول
                    </span>
                    <span className="bg-linear-to-l from-white to-navy-100 bg-clip-text font-heading text-3xl font-bold text-transparent">
                      أهلاً بعودتك
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-navy-200">
                    أدخل بياناتك للوصول إلى لوحة إدارة عملاء التمويل العقاري.
                  </p>
                </div>

                <form onSubmit={loginForm.handleSubmit(onLogin)} className="relative space-y-5">
                  {/* Email */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-navy-100">
                      البريد الإلكتروني <span className="text-brand">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 end-3.5 -translate-y-1/2 text-navy-400">
                        <Mail size={17} />
                      </span>
                      <input
                        {...loginForm.register('email')}
                        type="email"
                        dir="ltr"
                        placeholder="name@example.com"
                        className={`${fieldCls} pe-11 ps-4`}
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="mt-1 text-xs text-red-400">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-navy-100">
                      كلمة المرور <span className="text-brand">*</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute top-1/2 end-3.5 -translate-y-1/2 text-navy-400 transition-colors hover:text-navy-200"
                      >
                        {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                      <span className="pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2 text-navy-500">
                        <Lock size={16} />
                      </span>
                      <input
                        {...loginForm.register('password')}
                        type={showPw ? 'text' : 'password'}
                        dir="ltr"
                        placeholder="••••••••"
                        className={`${fieldCls} pe-11 ps-10`}
                      />
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="mt-1 text-xs text-red-400">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  {/* Remember + forgot */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                    <label className="flex cursor-pointer items-center gap-2 select-none text-navy-300">
                      <input type="checkbox" defaultChecked className="accent-brand rounded" />
                      تذكّرني
                    </label>
                    <button
                      type="button"
                      onClick={() => setPanel('forgot')}
                      className="font-medium text-brand transition-colors hover:text-brand-light"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="group mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-heading text-[15px] font-bold tracking-wide text-[#061018] shadow-[0_12px_40px_-12px_rgba(245,166,35,0.45)] transition-[transform,box-shadow] hover:bg-brand-light hover:shadow-[0_16px_48px_-12px_rgba(245,166,35,0.55)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isPending ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-navy-900/30 border-t-navy-900" />
                    ) : (
                      <>
                        <span>دخول</span>
                        <ArrowLeft size={18} className="transition-transform group-hover:translate-x-[-2px]" />
                      </>
                    )}
                  </button>
                </form>

                {/* divider */}
                <div className="mt-2 flex items-center gap-3 text-xs text-navy-500">
                  <span className="h-px flex-1 bg-navy-500/35" />
                  <span className="shrink-0">شركة راف الوطنية للتطوير والاستثمار العقاري</span>
                  <span className="h-px flex-1 bg-navy-500/35" />
                </div>
              </div>
            </div>
          )}

          {/* ══ FORGOT PASSWORD PANEL ══ */}
          {panel === 'forgot' && (
            <div className={cardShellCls}>
              <div className={cardInnerCls}>
                <div className="space-y-1">
                  <div className="mb-4 inline-flex flex-col gap-1">
                    <span className="font-heading text-[0.62rem] font-bold tracking-[0.32em] uppercase text-brand-light">
                      استرداد الحساب
                    </span>
                    <span className="font-heading text-3xl font-bold text-white">نسيت كلمة المرور؟</span>
                  </div>
                  <p className="text-sm text-navy-200">
                    أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.
                  </p>
                </div>

                <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-navy-100">البريد الإلكتروني</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 end-3.5 -translate-y-1/2 text-navy-400">
                        <Mail size={17} />
                      </span>
                      <input
                        {...forgotForm.register('email')}
                        type="email"
                        dir="ltr"
                        placeholder="name@example.com"
                        className={`${fieldCls} pe-11 ps-4`}
                      />
                    </div>
                    {forgotForm.formState.errors.email && (
                      <p className="mt-1 text-xs text-red-400">{forgotForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-heading text-[15px] font-bold text-[#061018] transition-colors hover:bg-brand-light disabled:opacity-50"
                  >
                    {isPending ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-navy-900/30 border-t-navy-900" />
                    ) : (
                      'إرسال رابط الاسترداد'
                    )}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => setPanel('login')}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-navy-400 transition-colors hover:text-navy-200"
                >
                  <ChevronLeft size={15} />
                  العودة لتسجيل الدخول
                </button>
              </div>
            </div>
          )}

          <footer className="mt-10 space-y-2 pb-6 text-center text-xs text-navy-600 md:pb-0">
            <div className="flex items-center justify-center gap-2 text-navy-500">
              <RafLogo size={18} />
              <span>© 2026 شركة راف الوطنية للتطوير والاستثمار العقاري</span>
            </div>
            <div className="text-navy-600">
              الرياض — حي الصحافة · س.ت 1009188749
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-navy-950 text-sm text-navy-400">
          جاري التحميل…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
