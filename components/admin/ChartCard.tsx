import { type ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export default function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 shadow-[0_2px_20px_-6px_rgba(14,26,51,0.10)] backdrop-blur-sm">
      {/* Subtle top accent */}
      <div className="absolute top-0 start-0 end-0 h-[1.5px] bg-gradient-to-r from-transparent via-brand/40 to-transparent rounded-t-2xl" />

      <div className="mb-4">
        <h3 className="text-navy-900 text-sm font-bold">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] font-medium text-gray-400">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}
