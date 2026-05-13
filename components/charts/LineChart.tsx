'use client'

import { useState, useRef, useCallback } from 'react'

interface DataPoint {
  label: string
  pending?: number
  approved?: number
  rejected?: number
  value?: number
}

interface LineChartProps {
  data: DataPoint[]
  height?: number
}

const LINES = [
  { key: 'approved' as const, color: '#22c55e', label: 'مقبول', bg: 'bg-green-500' },
  { key: 'pending' as const, color: '#f59e0b', label: 'معلق', bg: 'bg-amber-400' },
  { key: 'rejected' as const, color: '#ef4444', label: 'مرفوض', bg: 'bg-red-500' },
]

export default function LineChart({ data, height = 200 }: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const svgRef = useRef<SVGSVGElement>(null)

  const width = 600
  const pad = { t: 16, r: 20, b: 40, l: 36 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b

  const visibleLines = LINES.filter((l) => !hidden.has(l.key))

  const allVals = data.flatMap((d) =>
    LINES.filter((l) => !hidden.has(l.key)).map((l) => d[l.key] ?? 0)
  )
  const maxVal = Math.max(...allVals, 1)

  function xPos(i: number) {
    return pad.l + (data.length > 1 ? (i / (data.length - 1)) * W : W / 2)
  }
  function yPos(v: number) {
    return pad.t + H - (v / maxVal) * H
  }

  function pathD(key: 'pending' | 'approved' | 'rejected') {
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)},${yPos(d[key] ?? 0).toFixed(1)}`)
      .join(' ')
  }

  // Smooth filled area under each line
  function areaD(key: 'pending' | 'approved' | 'rejected') {
    const base = (pad.t + H).toFixed(1)
    const pts = data
      .map((d, i) => `${xPos(i).toFixed(1)},${yPos(d[key] ?? 0).toFixed(1)}`)
      .join(' L ')
    return `M ${xPos(0).toFixed(1)},${base} L ${pts} L ${xPos(data.length - 1).toFixed(1)},${base} Z`
  }

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxVal * (1 - t)))

  // Handle mouse move over SVG
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
    [data.length, W, pad.l, width]
  )

  const toggleLine = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleLabels = data.filter(
    (_, i) => data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1
  )

  const hovered = hoverIdx !== null ? data[hoverIdx] : null

  if (!data.length)
    return (
      <div className="flex h-32 items-center justify-center text-sm text-gray-300">
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
          {/* Horizontal grid + Y labels */}
          {yTicks.map((val, ti) => {
            const yy = pad.t + H * (ti / (yTicks.length - 1))
            return (
              <g key={ti}>
                <line x1={pad.l} x2={pad.l + W} y1={yy} y2={yy} stroke="#f3f4f6" strokeWidth="1" />
                <text x={pad.l - 6} y={yy + 4} textAnchor="end" fontSize="9" fill="#d1d5db">
                  {val}
                </text>
              </g>
            )
          })}

          {/* Filled areas (semi-transparent) */}
          {visibleLines.map(({ key, color }) => (
            <path key={`area-${key}`} d={areaD(key)} fill={color} fillOpacity="0.06" />
          ))}

          {/* Lines */}
          {visibleLines.map(({ key, color }) => (
            <path
              key={`line-${key}`}
              d={pathD(key)}
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Hover vertical line */}
          {hoverIdx !== null && (
            <line
              x1={xPos(hoverIdx)}
              x2={xPos(hoverIdx)}
              y1={pad.t}
              y2={pad.t + H}
              stroke="#e5e7eb"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}

          {/* Data points — always show on hover, always show all on small datasets */}
          {visibleLines.map(({ key, color }) =>
            data.map((d, i) => {
              const isHovered = hoverIdx === i
              const val = d[key] ?? 0
              if (data.length > 10 && !isHovered && val === 0) return null
              return (
                <circle
                  key={`dot-${key}-${i}`}
                  cx={xPos(i)}
                  cy={yPos(val)}
                  r={isHovered ? 5 : data.length <= 10 ? 3.5 : 0}
                  fill={color}
                  stroke="white"
                  strokeWidth="1.5"
                  style={{ transition: 'r 0.1s' }}
                />
              )
            })
          )}

          {/* X-axis labels */}
          {visibleLabels.map((d) => {
            const i = data.indexOf(d)
            return (
              <text
                key={i}
                x={xPos(i)}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill="#9ca3af"
              >
                {d.label.slice(5)}
              </text>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hovered && hoverIdx !== null && (
          <div
            className="pointer-events-none absolute z-10 min-w-[120px] rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-lg"
            style={{
              top: `${((yPos(Math.max(...visibleLines.map((l) => hovered[l.key] ?? 0))) - pad.t) / height) * 100}%`,
              left: `${(xPos(hoverIdx) / width) * 100}%`,
              transform:
                hoverIdx > data.length * 0.7 ? 'translate(-110%, -50%)' : 'translate(10%, -50%)',
            }}
          >
            <p className="mb-1.5 text-[11px] font-semibold text-gray-500">
              {hovered.label.slice(5)}
            </p>
            {visibleLines.map(({ key, color, label }) => (
              <div key={key} className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-gray-500">{label}</span>
                </div>
                <span className="font-semibold text-gray-800 tabular-nums">
                  {hovered[key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend — clickable to toggle lines */}
      <div className="mt-2 flex items-center justify-center gap-4">
        {LINES.map(({ key, color, label }) => {
          const isHidden = hidden.has(key)
          return (
            <button
              key={key}
              onClick={() => toggleLine(key)}
              className={`flex items-center gap-1.5 text-xs transition-opacity ${isHidden ? 'opacity-30' : 'opacity-100'}`}
              title={isHidden ? `إظهار ${label}` : `إخفاء ${label}`}
            >
              <span
                className="h-1.5 w-4 rounded-full transition-opacity"
                style={{ backgroundColor: color }}
              />
              <span className={isHidden ? 'text-gray-300 line-through' : 'text-gray-500'}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
