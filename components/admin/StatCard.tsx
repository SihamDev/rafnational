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
    iconWrap: 'bg-honey-pale text-gold',
    bar: 'bg-gold',
    val: 'text-ink',
  },
  pending: {
    iconWrap: 'bg-amber-50 text-amber-600',
    bar: 'bg-amber-400',
    val: 'text-ink',
  },
  approved: {
    iconWrap: 'bg-grass/10 text-grass-dark',
    bar: 'bg-grass',
    val: 'text-ink',
  },
  rejected: {
    iconWrap: 'bg-red-50 text-red-600',
    bar: 'bg-red-500',
    val: 'text-ink',
  },
  info: {
    iconWrap: 'bg-sky-50 text-sky-600',
    bar: 'bg-sky-400',
    val: 'text-ink',
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
        'card-lift group shadow-soft relative overflow-hidden rounded-2xl border border-black/[0.05] bg-white p-5',
        href && 'cursor-pointer'
      )}
    >
      <div className={cn('absolute start-0 end-0 top-0 h-[2px] rounded-t-2xl', t.bar)} />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', t.iconWrap)}>
            <Icon size={18} />
          </div>
          {delta && (
            <span className="bg-grass/10 text-grass-dark rounded-full px-2 py-0.5 text-[10px] font-bold">
              {delta}
            </span>
          )}
        </div>

        <p className={cn('font-sans text-3xl leading-none font-bold tabular-nums', t.val)}>
          {value}
        </p>
        <p className="text-muted-funnel mt-2 text-[12px] font-medium">{label}</p>
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
