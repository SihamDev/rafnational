'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  TrendingUp,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/actions/auth'
import { RafBrand } from '@/components/brand/RafLogo'
import { RAF_FUNNEL_URL, RAF_LOGO_LOGIN_SRC } from '@/lib/brand'
import type { StaffRole } from '@/types/leads'

const CRM_LINK = {
  href: '/admin/leads',
  label: 'العملاء (CRM)',
  icon: Briefcase,
  exact: false,
} as const

const AGENT_HOME_LINK = {
  href: '/admin/agent',
  label: 'مساحتي',
  icon: Target,
  exact: true,
} as const

const ADMIN_ONLY_NAV = [
  { href: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, exact: true },
  { href: '/admin/reports', label: 'التقارير والأداء', icon: TrendingUp },
  { href: '/admin/users', label: 'فريق المبيعات', icon: Users },
  { href: '/admin/activity', label: 'سجل النشاطات', icon: Activity },
  { href: '/admin/settings', label: 'الإعدادات', icon: Settings },
]

const STORAGE_KEY = 'admin_sidebar_collapsed'

interface AdminSidebarProps {
  leadsNewCount?: number
  staffRole?: StaffRole
}

export default function AdminSidebar({
  leadsNewCount = 0,
  staffRole = 'admin',
}: AdminSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') setCollapsed(true)
    setMounted(true)
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const navItems =
    staffRole === 'sales_agent'
      ? [
          { ...AGENT_HOME_LINK, exact: true as const },
          { ...CRM_LINK, exact: false as const },
        ]
      : [{ ...CRM_LINK, exact: false as const }, ...ADMIN_ONLY_NAV]

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-l transition-all duration-300 lg:flex',
        'border-white/10 bg-black text-white',
        collapsed ? 'w-[68px]' : 'w-60'
      )}
    >
      {/* Top glow */}
      <div className="bg-gold/15 pointer-events-none absolute start-1/2 -top-10 h-32 w-32 -translate-x-1/2 rounded-full blur-[50px]" />

      {/* Logo */}
      <div
        className={cn(
          'relative flex items-center border-b border-white/10 transition-all duration-300',
          collapsed ? 'justify-center p-4' : 'px-4 py-5'
        )}
      >
        <RafBrand
          logoSrc={RAF_LOGO_LOGIN_SRC}
          logoHref={RAF_FUNNEL_URL}
          logoClassName={cn(
            'h-auto w-auto object-contain',
            collapsed ? 'max-h-10 max-w-[52px]' : 'max-h-[88px] w-auto md:max-h-24'
          )}
          wordmarkTheme="light"
          showWordmark={false}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2.5 py-3">
        {!collapsed && (
          <p className="px-3 py-2 font-sans text-[9.5px] font-semibold tracking-[0.18em] text-white/55 uppercase">
            {staffRole === 'sales_agent' ? 'مساحة المبيعات' : 'الإدارة والمبيعات'}
          </p>
        )}

        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-white/75 hover:bg-white/5 hover:text-white'
              )}
            >
              {/* Gold left accent line for active */}
              {active && (
                <span className="bg-brand absolute end-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" />
              )}
              <Icon
                size={15}
                className={cn(
                  'shrink-0 transition-colors',
                  active ? 'text-brand' : 'text-white/55 group-hover:text-white/90'
                )}
              />
              {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}

              {/* Leads badge */}
              {!collapsed && item.href === '/admin/leads' && leadsNewCount > 0 && (
                <span className="ms-auto shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white ring-1 ring-white/15">
                  {leadsNewCount > 99 ? '99+' : leadsNewCount}
                </span>
              )}
              {collapsed && item.href === '/admin/leads' && leadsNewCount > 0 && (
                <span className="bg-brand absolute -start-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-black" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-0.5 border-t border-white/10 px-2.5 py-3">
        <button
          onClick={toggle}
          title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-2'
          )}
        >
          {mounted && (collapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />)}
          {!collapsed && <span>طي القائمة</span>}
        </button>

        <form action={signOut}>
          <button
            title={collapsed ? 'تسجيل الخروج' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-white/60 transition-colors hover:bg-red-500/15 hover:text-red-300',
              collapsed && 'justify-center px-2'
            )}
          >
            <LogOut size={14} className="shrink-0" />
            {!collapsed && 'تسجيل الخروج'}
          </button>
        </form>
      </div>
    </aside>
  )
}
