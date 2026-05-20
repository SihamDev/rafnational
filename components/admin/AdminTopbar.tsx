import { getStaffUser } from '@/lib/supabase/server'
import { Zap } from 'lucide-react'
import { RafLogo } from '@/components/brand/RafLogo'
import { RAF_LOGO_LOGIN_SRC } from '@/lib/brand'
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
      ? 'text-gold'
      : staff?.role === 'sales_agent'
        ? 'text-grass-dark'
        : 'text-muted-funnel'

  return (
    <header className="border-gold/20 shadow-soft sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b bg-white/90 px-6 py-3.5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {breadcrumb && (
          <div className="text-muted-funnel flex items-center gap-1.5 text-[11px]">
            <span>راف الوطنية</span>
            <span className="text-black/15">/</span>
            <span>{breadcrumb}</span>
            <span className="text-black/15">/</span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          {!breadcrumb && (
            <span className="text-muted-funnel hidden text-[11px] sm:inline">
              راف الوطنية
              <span className="mx-1.5 text-black/15">/</span>
            </span>
          )}
          <h1 className="font-heading text-ink text-base leading-none font-bold">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {staff?.role === 'admin' && <NotificationsBell />}

        <div className="border-grass/25 bg-grass/10 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 sm:flex">
          <span className="bg-grass h-1.5 w-1.5 animate-pulse rounded-full" />
          <span className="text-grass-dark text-[10px] font-semibold">مباشر</span>
        </div>

        <Link
          href={staff?.role === 'admin' ? '/admin/settings' : '/admin/leads'}
          className="group shadow-soft hover:border-gold/35 hover:shadow-soft-lg flex items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white px-3 py-2 transition-all"
        >
          <div className="ring-gold/20 flex h-8 min-w-[2.75rem] items-center justify-center rounded-xl bg-black/90 px-1 ring-1">
            <RafLogo
              src={RAF_LOGO_LOGIN_SRC}
              className="max-h-6 w-auto object-contain"
              width={44}
              height={24}
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-ink text-[11px] leading-tight font-semibold">{email}</p>
            <p className={`text-[9px] font-bold tracking-wide ${roleColor}`}>{roleLabel}</p>
          </div>
          <Zap
            size={11}
            className="group-hover:text-gold hidden text-black/20 transition-colors sm:block"
          />
        </Link>
      </div>
    </header>
  )
}
