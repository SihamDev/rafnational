'use client'

/**
 * Client-only wrapper for all dashboard charts.
 * `ssr: false` is only allowed in Client Components, so the dynamic imports
 * live here instead of in the Server Component page.
 */
import dynamic from 'next/dynamic'

const LineChartDynamic = dynamic(() => import('./LineChart'), { ssr: false })
const BarChartDynamic  = dynamic(() => import('./BarChart'),  { ssr: false })
const PieChartDynamic  = dynamic(() => import('./PieChart'),  { ssr: false })

/* ── re-export prop shapes so the page can type-check ── */
export type LineChartData = { date: string; total: number; qualified: number; unqualified: number }[]
export type BarChartData  = { label: string; value: number }[]
export type PieChartData  = { label: string; value: number }[]

export function LineChart({ data }: { data: LineChartData }) {
  return <LineChartDynamic data={data} />
}

export function BarChart({ data, color }: { data: BarChartData; color?: string }) {
  return <BarChartDynamic data={data} color={color} />
}

export function PieChart({
  data,
  centerLabel,
  overrideTotal,
}: {
  data: PieChartData
  centerLabel?: string
  overrideTotal?: number
}) {
  return <PieChartDynamic data={data} centerLabel={centerLabel} overrideTotal={overrideTotal} />
}
