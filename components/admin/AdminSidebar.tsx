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
import type { StaffRole } from '@/types/leads'

/* ── RAF National inline logo mark ── */
function RafMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
      <path
        d="M18 2L32 10.5V25.5L18 34L4 25.5V10.5L18 2Z"
        fill="url(#sbGrad)"
        stroke="#F5A623"
        strokeWidth="0.75"
        strokeOpacity="0.5"
      />
      <path
        d="M18 7L28 13V25L18 31L8 25V13L18 7Z"
        fill="none"
        stroke="#F5A623"
        strokeWidth="0.4"
        strokeOpacity="0.22"
      />
      <text
        x="18" y="24"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fontFamily="'El Messiri', serif"
        fill="#F5A623"
      >
        ر
      </text>
      <defs>
        <linearGradient id="sbGrad" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#162844" />
          <stop offset="1" stopColor="#0c1828" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function RafBrandExpanded() {
  return (
    <div className="flex items-center gap-3">
      <RafMark size={40} />
      <div className="flex flex-col leading-tight">
        <span className="font-heading text-[15px] font-bold text-white tracking-tight">
          راف الوطنية
        </span>
        <span className="text-brand font-sans text-[9px] font-semibold tracking-[0.22em] uppercase opacity-80">
          RAF NATIONAL
        </span>
      </div>
    </div>
  )
}

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
  { href: '/admin',          label: 'لوحة التحكم',     icon: LayoutDashboard, exact: true },
  { href: '/admin/reports',  label: 'التقارير والأداء', icon: TrendingUp },
  { href: '/admin/users',    label: 'فريق المبيعات',   icon: Users },
  { href: '/admin/activity', label: 'سجل النشاطات',    icon: Activity },
  { href: '/admin/settings', label: 'الإعدادات',        icon: Settings },
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

  const navItems = staffRole === 'sales_agent'
    ? [
        { ...AGENT_HOME_LINK, exact: true as const },
        { ...CRM_LINK, exact: false as const },
      ]
    : [{ ...CRM_LINK, exact: false as const }, ...ADMIN_ONLY_NAV]

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-l transition-all duration-300 lg:flex',
        'bg-[#0a1220] border-white/[0.06]',
        collapsed ? 'w-[68px]' : 'w-60'
      )}
    >
      {/* Top glow */}
      <div className="pointer-events-none absolute -top-10 start-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-brand/10 blur-[50px]" />

      {/* Logo */}
      <div
        className={cn(
          'relative flex items-center border-b border-white/[0.06] transition-all duration-300',
          collapsed ? 'justify-center p-4' : 'px-4 py-5'
        )}
      >
        {collapsed ? <RafMark size={34} /> : <RafBrandExpanded />}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2.5 py-3">
        {!collapsed && (
          <p className="px-3 py-2 font-sans text-[9.5px] font-semibold tracking-[0.18em] uppercase text-white/30">
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
                  ? 'bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]'
                  : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80'
              )}
            >
              {/* Gold left accent line for active */}
              {active && (
                <span className="absolute end-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand" />
              )}
              <Icon
                size={15}
                className={cn(
                  'shrink-0 transition-colors',
                  active ? 'text-brand' : 'text-white/35 group-hover:text-white/60'
                )}
              />
              {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}

              {/* Leads badge */}
              {!collapsed && item.href === '/admin/leads' && leadsNewCount > 0 && (
                <span className="ms-auto shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                  {leadsNewCount > 99 ? '99+' : leadsNewCount}
                </span>
              )}
              {collapsed && item.href === '/admin/leads' && leadsNewCount > 0 && (
                <span className="absolute -top-0.5 -start-0.5 h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-2.5 py-3 space-y-0.5">
        <button
          onClick={toggle}
          title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/60',
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
              'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400',
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
