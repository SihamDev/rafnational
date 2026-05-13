import { getStaffUser } from '@/lib/supabase/server'
import { ShieldCheck, Zap } from 'lucide-react'
import Link from 'next/link'
import NotificationsBell from './NotificationsBell'

interface AdminTopbarProps {
  title: string
  breadcrumb?: string
  adminEmail?: string
}

export default async function AdminTopbar({ title, breadcrumb, adminEmail }: AdminTopbarProps) {
  const staff = await getStaffUser()
  const email = adminEmail ?? staff?.user.email
  const roleLabel =
    staff?.role === 'admin'
      ? 'مدير النظام'
      : staff?.role === 'sales_agent'
        ? 'مسؤول المبيعات'
        : 'عضو'

  const roleColor =
    staff?.role === 'admin'
      ? 'text-brand'
      : staff?.role === 'sales_agent'
        ? 'text-emerald-500'
        : 'text-white/50'

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.55] bg-white/80 px-6 py-3.5 backdrop-blur-md">
      {/* Left: title */}
      <div className="flex items-center gap-3">
        {breadcrumb && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span>راف الوطنية</span>
            <span className="text-gray-300">/</span>
            <span>{breadcrumb}</span>
            <span className="text-gray-300">/</span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          {!breadcrumb && (
            <span className="hidden text-[11px] text-gray-400 sm:inline">
              راف الوطنية
              <span className="mx-1.5 text-gray-300">/</span>
            </span>
          )}
          <h1 className="text-navy-900 text-base font-bold leading-none">{title}</h1>
        </div>
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-2.5">
        {staff?.role === 'admin' && <NotificationsBell />}

        {/* Live indicator */}
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 sm:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[10px] font-semibold text-emerald-600">مباشر</span>
        </div>

        {/* User chip */}
        <Link
          href={staff?.role === 'admin' ? '/admin/settings' : '/admin/leads'}
          className="group flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm transition-all hover:border-brand/30 hover:shadow-md"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900 shadow-sm">
            <ShieldCheck size={14} className={roleColor} />
          </div>
          <div className="hidden sm:block">
            <p className="text-navy-900 text-[11px] font-semibold leading-tight">{email}</p>
            <p className={`text-[9px] font-bold tracking-wide ${roleColor}`}>{roleLabel}</p>
          </div>
          <Zap size={11} className="hidden text-gray-300 transition-colors group-hover:text-brand sm:block" />
        </Link>
      </div>
    </header>
  )
}
