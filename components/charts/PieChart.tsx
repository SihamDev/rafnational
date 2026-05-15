'use client'

interface PieData {
  label: string
  value: number
}

const COLORS = ['#f5a623', '#0f2847', '#22c55e', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']

export default function PieChart({ data, centerLabel = 'عميل', overrideTotal }: { data: PieData[]; centerLabel?: string; overrideTotal?: number }) {
  if (!data.length)
    return (
      <div className="flex h-32 items-center justify-center text-sm text-gray-300">
        لا توجد بيانات
      </div>
    )

  const dataTotal = data.reduce((s, d) => s + d.value, 0) || 1
  const displayTotal = overrideTotal ?? dataTotal
  const total = dataTotal
  const cx = 100,
    cy = 100,
    r = 80,
    innerR = 45

  // f() serialises a coordinate to a fixed-width string so SSR and client
  // always produce the exact same path attribute — floating-point toString()
  // can vary between Node and browser for the same computed value.
  const f = (v: number) => v.toFixed(3)

  let startAngle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI
    const x1  = cx + r      * Math.cos(startAngle)
    const y1  = cy + r      * Math.sin(startAngle)
    const x2  = cx + r      * Math.cos(startAngle + angle)
    const y2  = cy + r      * Math.sin(startAngle + angle)
    const xi1 = cx + innerR * Math.cos(startAngle)
    const yi1 = cy + innerR * Math.sin(startAngle)
    const xi2 = cx + innerR * Math.cos(startAngle + angle)
    const yi2 = cy + innerR * Math.sin(startAngle + angle)
    const large = angle > Math.PI ? 1 : 0
    const path = `M ${f(xi1)} ${f(yi1)} L ${f(x1)} ${f(y1)} A ${r} ${r} 0 ${large} 1 ${f(x2)} ${f(y2)} L ${f(xi2)} ${f(yi2)} A ${innerR} ${innerR} 0 ${large} 0 ${f(xi1)} ${f(yi1)} Z`
    const midAngle = startAngle + angle / 2
    startAngle += angle
    return {
      path,
      color: COLORS[i % COLORS.length],
      label: d.label,
      value: d.value,
      midAngle,
      pct: Math.round((d.value / total) * 100),
    }
  })

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 200 200" className="h-40 w-40 shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#0f2847">
          {new Intl.NumberFormat('ar-SA').format(displayTotal)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">
          {centerLabel}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="max-w-28 truncate">{s.label}</span>
            <span className="text-navy-900 ms-auto font-sans font-semibold">{s.value}</span>
            <span className="font-sans text-gray-400">({s.pct}٪)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
