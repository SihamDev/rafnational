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
  { key: 'approved' as const, color: '#10b981', label: 'مؤهَّل' },
  { key: 'rejected' as const, color: '#f97316', label: 'غير مؤهل' },
]

/** Straight-line path — accurate for spiky data, no bezier overshoot */
function linePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
}

function areaPath(points: { x: number; y: number }[], baseY: number): string {
  if (points.length === 0) return ''
  const line = linePath(points)
  return `${line} L ${points[points.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L ${points[0].x.toFixed(1)},${baseY.toFixed(1)} Z`
}

export default function LineChart({ data, height = 220 }: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const width = 640
  const pad = { t: 24, r: 20, b: 44, l: 44 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b

  /* ── compute max, capping outlier days so small values stay visible ── */
  const niceMax = useMemo(() => {
    if (!data.length) return 1
    const dayTotals = data.map((d) => LINES.reduce((s, l) => s + (d[l.key] ?? 0), 0))
    const sorted = [...dayTotals].sort((a, b) => b - a)
    let effective = sorted[0]
    // if the top day is >4× the second-highest, cap at 3× second-highest
    if (sorted.length >= 2 && sorted[1] > 0 && sorted[0] > sorted[1] * 4) {
      effective = sorted[1] * 3
    }
    if (effective <= 0) return 1
    const mag = Math.pow(10, Math.floor(Math.log10(effective)))
    return Math.ceil(effective / mag) * mag
  }, [data])

  function xPos(i: number) {
    return pad.l + (data.length > 1 ? (i / (data.length - 1)) * W : W / 2)
  }
  function yPos(v: number) {
    // clamp so values above niceMax don't escape the chart area
    const clamped = Math.min(v, niceMax)
    return pad.t + H - (clamped / niceMax) * H
  }

  function getPoints(key: 'approved' | 'rejected') {
    return data.map((d, i) => ({ x: xPos(i), y: yPos(d[key] ?? 0) }))
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
    if (!indices.includes(data.length - 1)) indices.push(data.length - 1)
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
  const baseY = pad.t + H

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
            {LINES.map(({ key, color }) => (
              <linearGradient key={key} id={`g-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid */}
          {yTicks.map((val, ti) => {
            const yy = pad.t + H * (ti / (yTicks.length - 1))
            return (
              <g key={ti}>
                <line x1={pad.l} x2={pad.l + W} y1={yy} y2={yy} stroke="#f1f5f9" strokeWidth="1" />
                <text x={pad.l - 8} y={yy + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">
                  {val}
                </text>
              </g>
            )
          })}

          {/* Area fills */}
          {LINES.map(({ key }) => (
            <path key={`a-${key}`} d={areaPath(getPoints(key), baseY)} fill={`url(#g-${key})`} />
          ))}

          {/* Lines */}
          {LINES.map(({ key, color }) => (
            <path
              key={`l-${key}`}
              d={linePath(getPoints(key))}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Hover crosshair */}
          {hoverIdx !== null && (
            <line
              x1={xPos(hoverIdx)} x2={xPos(hoverIdx)}
              y1={pad.t} y2={baseY}
              stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3"
            />
          )}

          {/* Dots */}
          {LINES.map(({ key, color }) =>
            data.map((d, i) => {
              const val = d[key] ?? 0
              const isHovered = hoverIdx === i
              const isLast = i === data.length - 1
              const show = isHovered || isLast || data.length <= 10
              if (!show && val === 0) return null
              return (
                <circle
                  key={`d-${key}-${i}`}
                  cx={xPos(i)} cy={yPos(val)}
                  r={isHovered ? 5 : isLast ? 4 : 3}
                  fill="white"
                  stroke={color}
                  strokeWidth={isHovered || isLast ? 2.5 : 2}
                />
              )
            })
          )}

          {/* Label today's actual value above the dot */}
          {LINES.map(({ key, color }) => {
            const i = data.length - 1
            const val = data[i]?.[key] ?? 0
            if (val === 0) return null
            return (
              <text
                key={`tl-${key}`}
                x={xPos(i)} y={yPos(val) - 8}
                textAnchor="middle" fontSize="10" fontWeight="700"
                fill={color} fontFamily="system-ui"
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
                fill={isLast ? '#475569' : '#94a3b8'}
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
            className="pointer-events-none absolute z-10 min-w-[140px] rounded-xl border border-gray-100 bg-white/95 backdrop-blur-sm px-3.5 py-3 shadow-xl"
            style={{
              top: `${((yPos(Math.max(...LINES.map((l) => hovered[l.key] ?? 0))) - pad.t) / height) * 100}%`,
              left: `${(xPos(hoverIdx) / width) * 100}%`,
              transform: hoverIdx > data.length * 0.7 ? 'translate(-110%, -50%)' : 'translate(10%, -50%)',
            }}
          >
            <p className="mb-2 text-[11px] font-bold text-gray-400">
              {hoverIdx === data.length - 1 ? 'اليوم' : hovered.label}
            </p>
            {LINES.map(({ key, color, label }) => (
              <div key={key} className="flex items-center justify-between gap-5 py-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-gray-600 font-medium">{label}</span>
                </div>
                <span className="font-bold text-gray-900 tabular-nums">{hovered[key] ?? 0}</span>
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
