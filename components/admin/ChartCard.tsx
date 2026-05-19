import { type ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export default function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="crm-card card-lift p-5">
      <div className="mb-4">
        <h3 className="font-heading text-ink text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-muted-funnel mt-0.5 text-[11px] font-medium">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
