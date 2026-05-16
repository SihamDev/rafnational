'use client'

import { useState, useRef, useCallback, useMemo } from 'react'

interface DataPoint {
  label: string
  approved?: number
  rejected?: number
  pending?: number
  value?: number
}

export type LineChartDataPoint = DataPoint

interface LineChartProps {
  data: LineChartDataPoint[]
  height?: number
}

export type { LineChartProps }

const LINES = [
  { key: 'approved' as const, color: '#10b981', gradient: ['#10b981', '#6ee7b7'], label: 'مؤهَّل' },
  { key: 'rejected' as const, color: '#f97316', gradient: ['#f97316', '#fdba74'], label: 'غير مؤهل' },
]

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx.toFixed(1)},${prev.y.toFixed(1)} ${cpx.toFixed(1)},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`
  }
  return d
}

export default function LineChart({ data, height = 220 }: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const width = 640
  const pad = { t: 20, r: 16, b: 44, l: 44 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b

  const maxVal = useMemo(() => {
    let max = 0
    for (const d of data) {
      for (const l of LINES) {
        const v = d[l.key] ?? 0
        if (v > max) max = v
      }
    }
    return Math.max(max, 1)
  }, [data])

  // If one day massively dominates (e.g. a bulk import), cap the y-axis at
  // 3× the second-highest day so today's small counts are still visible.
  const cappedMax = useMemo(() => {
    const allDayTotals = data.map((d) =>
      LINES.reduce((s, l) => s + (d[l.key] ?? 0), 0)
    )
    const sorted = [...allDayTotals].sort((a, b) => b - a)
    if (sorted.length >= 2 && sorted[0] > sorted[1] * 4 && sorted[1] > 0) {
      return sorted[1] * 3
    }
    return maxVal
  }, [data, maxVal])

  const niceMax = useMemo(() => {
    const v = cappedMax
    if (v === 0) return 1
    const mag = Math.pow(10, Math.floor(Math.log10(v)))
    return Math.ceil(v / mag) * mag || 1
  }, [cappedMax])

  function xPos(i: number) {
    return pad.l + (data.length > 1 ? (i / (data.length - 1)) * W : W / 2)
  }
  function yPos(v: number) {
    return pad.t + H - (v / niceMax) * H
  }

  function getPoints(key: 'approved' | 'rejected') {
    return data.map((d, i) => ({ x: xPos(i), y: yPos(d[key] ?? 0) }))
  }

  function areaPath(key: 'approved' | 'rejected') {
    const points = getPoints(key)
    if (points.length < 2) return ''
    const line = smoothPath(points)
    const base = pad.t + H
    return `${line} L ${points[points.length - 1].x.toFixed(1)},${base.toFixed(1)} L ${points[0].x.toFixed(1)},${base.toFixed(1)} Z`
  }

  const yTicks = useMemo(() => {
    const count = 4
    return Array.from({ length: count + 1 }, (_, i) => Math.round((niceMax / count) * (count - i)))
  }, [niceMax])

  const visibleLabels = useMemo(() => {
    if (data.length <= 7) return data.map((_, i) => i)
    const step = Math.ceil(data.length / 6)
    const indices: number[] = [0]
    for (let i = step; i < data.length - 1; i += step) indices.push(i)
    indices.push(data.length - 1)
    return indices
  }, [data.length])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg || !data.length) return
      const rect = svg.getBoundingClientRect()
      const svgX = ((e.clientX - rect.left) / rect.width) * width
      const rel = (svgX - pad.l) / W
      const idx = Math.round(rel * (data.length - 1))
      setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)))
    },
    [data.length, W, width]
  )

  const hovered = hoverIdx !== null ? data[hoverIdx] : null

  if (!data.length)
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-300">
        لا توجد بيانات
      </div>
    )

  return (
    <div className="w-full select-none">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            {LINES.map(({ key, gradient }) => (
              <linearGradient key={`grad-${key}`} id={`area-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradient[0]} stopOpacity="0.2" />
                <stop offset="100%" stopColor={gradient[1]} stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {yTicks.map((val, ti) => {
            const yy = pad.t + H * (ti / (yTicks.length - 1))
            return (
              <g key={ti}>
                <line
                  x1={pad.l} x2={pad.l + W} y1={yy} y2={yy}
                  stroke="#f1f5f9" strokeWidth="1"
                />
                <text x={pad.l - 8} y={yy + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">
                  {val}
                </text>
              </g>
            )
          })}

          {/* Area fills */}
          {LINES.map(({ key }) => (
            <path
              key={`area-${key}`}
              d={areaPath(key)}
              fill={`url(#area-grad-${key})`}
            />
          ))}

          {/* Lines (smooth) */}
          {LINES.map(({ key, color }) => (
            <path
              key={`line-${key}`}
              d={smoothPath(getPoints(key))}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Hover vertical line */}
          {hoverIdx !== null && (
            <line
              x1={xPos(hoverIdx)} x2={xPos(hoverIdx)}
              y1={pad.t} y2={pad.t + H}
              stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3"
            />
          )}

          {/* Data dots */}
          {LINES.map(({ key, color }) =>
            data.map((d, i) => {
              const val = d[key] ?? 0
              const isHovered = hoverIdx === i
              const isLast = i === data.length - 1
              const show = isHovered || isLast || data.length <= 10
              if (!show && val === 0) return null
              return (
                <circle
                  key={`dot-${key}-${i}`}
                  cx={xPos(i)} cy={yPos(val)}
                  r={isHovered ? 5 : isLast ? 4 : show ? 3 : 0}
                  fill="white"
                  stroke={color}
                  strokeWidth={isHovered || isLast ? 2.5 : 2}
                  style={{ transition: 'r 0.15s ease' }}
                />
              )
            })
          )}

          {/* Always label the last point (today) with its value */}
          {data.length > 0 && LINES.map(({ key, color }) => {
            const lastIdx = data.length - 1
            const val = data[lastIdx][key] ?? 0
            if (val === 0) return null
            const cx = xPos(lastIdx)
            const cy = yPos(val)
            return (
              <text
                key={`last-label-${key}`}
                x={cx}
                y={cy - 9}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={color}
                fontFamily="system-ui"
              >
                {val}
              </text>
            )
          })}

          {/* X-axis labels */}
          {visibleLabels.map((i) => {
            const isLast = i === data.length - 1
            return (
              <text
                key={i}
                x={xPos(i)} y={height - 8}
                textAnchor="middle" fontSize="10"
                fill={isLast ? '#64748b' : '#94a3b8'}
                fontWeight={isLast ? '700' : '400'}
                fontFamily="system-ui"
              >
                {isLast ? 'اليوم' : data[i].label.slice(5)}
              </text>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hovered && hoverIdx !== null && (
          <div
            className="pointer-events-none absolute z-10 min-w-[130px] rounded-xl border border-gray-100 bg-white/95 backdrop-blur-sm px-3.5 py-3 shadow-xl"
            style={{
              top: `${((yPos(Math.max(...LINES.map((l) => hovered[l.key] ?? 0))) - pad.t) / height) * 100}%`,
              left: `${(xPos(hoverIdx) / width) * 100}%`,
              transform: hoverIdx > data.length * 0.7 ? 'translate(-110%, -50%)' : 'translate(10%, -50%)',
            }}
          >
            <p className="mb-2 text-[11px] font-bold text-gray-400 tabular-nums">
              {hovered.label}
            </p>
            {LINES.map(({ key, color, label }) => (
              <div key={key} className="flex items-center justify-between gap-5 py-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-gray-600 font-medium">{label}</span>
                </div>
                <span className="font-bold text-gray-900 tabular-nums">
                  {hovered[key] ?? 0}
                </span>
              </div>
            ))}
            <div className="mt-1.5 border-t border-gray-100 pt-1.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">الإجمالي</span>
              <span className="font-bold text-gray-900 tabular-nums">
                {(hovered.approved ?? 0) + (hovered.rejected ?? 0)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6">
        {LINES.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-500 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
