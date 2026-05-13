'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { resetPassword } from '@/lib/actions/auth'

const schema = z
  .object({
    password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirm'],
  })

type FormData = z.infer<typeof schema>

const fieldCls =
  'w-full rounded-2xl border border-white/[0.1] bg-white/[0.05] py-3.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-navy-400 backdrop-blur-sm transition-[border-color,box-shadow] duration-200 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/20'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  function onSubmit(data: FormData) {
    start(async () => {
      const res = await resetPassword(data.password)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('تم تغيير كلمة المرور بنجاح')
        router.push('/admin')
      }
    })
  }

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 px-4 py-12"
    >
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-brand/8 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-blue-800/10 blur-[90px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 ring-1 ring-brand/30">
            <ShieldCheck size={28} className="text-brand" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-brand/60">
              RAF NATIONAL
            </p>
            <h1 className="mt-1 font-heading text-xl font-bold text-white">
              تعيين كلمة مرور جديدة
            </h1>
            <p className="mt-1.5 text-xs text-white/40">
              أدخل كلمة مرور قوية لحماية حسابك
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-[2rem] border border-white/[0.12] bg-gradient-to-br from-white/[0.09] via-navy-900/55 to-navy-950/80 p-[1px] shadow-[0_32px_100px_-24px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
          <div className="relative space-y-5 rounded-[1.85rem] bg-navy-950/75 px-8 py-9 ring-1 ring-white/[0.06]">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* New password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/60">كلمة المرور الجديدة</label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-white/30">
                    <Lock size={15} />
                  </span>
                  <input
                    {...register('password')}
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`${fieldCls} pe-10 ps-10`}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute top-1/2 left-3.5 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-400">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/60">تأكيد كلمة المرور</label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-white/30">
                    <Lock size={15} />
                  </span>
                  <input
                    {...register('confirm')}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`${fieldCls} pe-10 ps-10`}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute top-1/2 left-3.5 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.confirm && (
                  <p className="text-xs text-rose-400">{errors.confirm.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="relative w-full overflow-hidden rounded-2xl bg-brand py-3.5 text-sm font-bold text-navy-950 shadow-[0_4px_28px_-4px_rgba(245,166,35,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-900/30 border-t-navy-900" />
                    جارٍ التحديث…
                  </span>
                ) : (
                  'تغيير كلمة المرور'
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/25">
          © {new Date().getFullYear()} RAF National · جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  )
}
