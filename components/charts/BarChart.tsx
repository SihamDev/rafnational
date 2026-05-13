'use client'

interface BarData {
  label: string
  value: number
}

interface BarChartProps {
  data: BarData[]
  height?: number
  color?: string
}

export default function BarChart({ data, height = 180, color = '#f5a623' }: BarChartProps) {
  if (!data.length)
    return (
      <div className="flex h-32 items-center justify-center text-sm text-gray-300">
        لا توجد بيانات
      </div>
    )

  const width = 600
  const pad = { t: 10, r: 10, b: 50, l: 10 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const barW = Math.min(W / data.length - 6, 40)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {data.map((d, i) => {
        const bH = (d.value / maxVal) * H
        const bX = pad.l + (i / data.length) * W + (W / data.length - barW) / 2
        const bY = pad.t + H - bH
        return (
          <g key={i}>
            <rect x={bX} y={bY} width={barW} height={bH} fill={color} rx="4" opacity="0.85" />
            <text x={bX + barW / 2} y={bY - 4} textAnchor="middle" fontSize="10" fill="#6b7280">
              {d.value}
            </text>
            <text
              x={bX + barW / 2}
              y={pad.t + H + 16}
              textAnchor="middle"
              fontSize="9"
              fill="#9ca3af"
            >
              {d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
