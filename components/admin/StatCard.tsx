import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: 'base' | 'pending' | 'approved' | 'rejected' | 'info'
  delta?: string
  href?: string
}

const TONE = {
  base: {
    shell: 'bg-navy-900 border-navy-800',
    accent: 'bg-brand/15',
    icon: 'text-brand',
    val: 'text-white',
    bar: 'bg-brand',
  },
  pending: {
    shell: 'bg-[#1c160a] border-amber-900/40',
    accent: 'bg-amber-500/15',
    icon: 'text-amber-400',
    val: 'text-amber-300',
    bar: 'bg-amber-400',
  },
  approved: {
    shell: 'bg-[#0b1a10] border-emerald-900/40',
    accent: 'bg-emerald-500/15',
    icon: 'text-emerald-400',
    val: 'text-emerald-300',
    bar: 'bg-emerald-400',
  },
  rejected: {
    shell: 'bg-[#1a0b0b] border-red-900/40',
    accent: 'bg-red-500/15',
    icon: 'text-red-400',
    val: 'text-red-300',
    bar: 'bg-red-500',
  },
  info: {
    shell: 'bg-[#0b1220] border-blue-900/40',
    accent: 'bg-blue-500/15',
    icon: 'text-blue-400',
    val: 'text-blue-300',
    bar: 'bg-blue-400',
  },
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'base',
  delta,
  href,
}: StatCardProps) {
  const t = TONE[tone]

  const inner = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-5 transition-all hover:scale-[1.015] hover:shadow-xl',
        t.shell
      )}
    >
      {/* Top accent bar */}
      <div className={cn('absolute top-0 start-0 end-0 h-[2px] rounded-t-2xl', t.bar)} />

      {/* Glow blob */}
      <div className={cn('absolute -top-6 -end-6 h-20 w-20 rounded-full blur-2xl', t.accent)} />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', t.accent)}>
            <Icon size={17} className={t.icon} />
          </div>
          {delta && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              {delta}
            </span>
          )}
        </div>

        <p className={cn('font-sans text-3xl font-bold leading-none', t.val)}>{value}</p>
        <p className="mt-2 text-[12px] font-medium text-white/40">{label}</p>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} className="block">
        {inner}
      </a>
    )
  }
  return inner
}
