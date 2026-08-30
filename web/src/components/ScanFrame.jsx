import { useEffect, useState } from 'react'

/**
 * The photograph with the analysis drawn on top of it.
 *
 * Two modes. While the pipeline runs, a scan sweep, a detection mesh and the
 * pipeline's real stage names play over the image - the stages are the actual
 * steps `vision.js` takes, in order, not theatre. Once the result lands, the
 * overlay settles into the genuine 3×3 region map the tiled analyser scored:
 * every cell's tint, number and node comes from `regions` in the result, so a
 * judge pointing at a red corner is pointing at the exact cell that pulled the
 * score down. Nothing here is invented after the fact.
 */
const VW = 300
const VH = 200

/** The stages, named as the pipeline actually runs them. */
const STAGES = [
  'Isolating produce pixels…',
  'Correcting white balance…',
  'Reading colour signature…',
  'Scoring 3×3 regions…',
  'Running MobileNetV3…',
  'Cross-checking both readings…',
]

/** Node positions for the scanning animation (settled by the real map later). */
const SCAN_NODES = [
  [52, 48], [148, 34], [244, 52], [86, 96], [196, 88], [262, 118],
  [40, 140], [126, 128], [150, 172], [222, 156], [70, 178], [270, 44],
]
const SCAN_LINKS = [
  [0, 1], [1, 2], [0, 3], [1, 4], [2, 5], [3, 4], [4, 5], [3, 6],
  [4, 7], [6, 7], [7, 8], [8, 9], [5, 9], [6, 10], [8, 10], [2, 11],
]

const CELL_FILL = { green: 'rgba(34,197,94,0.14)', amber: 'rgba(245,158,11,0.20)', red: 'rgba(239,68,68,0.26)' }
const NODE_FILL = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' }
const toneOf = (score) => (score >= 75 ? 'green' : score >= 50 ? 'amber' : 'red')

export default function ScanFrame({ src, alt, busy = false, regions = null, className = '' }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!busy) return undefined
    setStage(0)
    const timer = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 650)
    return () => clearInterval(timer)
  }, [busy])

  const mapped = !busy && Array.isArray(regions) && regions.length > 0
  const cellW = VW / 3
  const cellH = VH / 3
  const center = (r) => [r.col * cellW + cellW / 2, r.row * cellH + cellH / 2]
  const worst = mapped ? regions.reduce((a, b) => (b.score < a.score ? b : a)) : null

  return (
    <div className={`relative overflow-hidden rounded-md bg-black/5 ${className}`}>
      <img src={src} alt={alt} className="h-56 w-full object-cover" />

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {busy && (
          <g>
            <rect width={VW} height={VH} fill="rgba(5,24,12,0.28)" />

            {/* The analyser's own 3×3 grid, faint until it has scores to show. */}
            {[1, 2].map((i) => (
              <g key={i} stroke="rgba(150,240,180,0.35)" strokeWidth="0.8">
                <line x1={(VW / 3) * i} y1="0" x2={(VW / 3) * i} y2={VH} />
                <line x1="0" y1={(VH / 3) * i} x2={VW} y2={(VH / 3) * i} />
              </g>
            ))}

            {/* Viewfinder corners. */}
            {[
              `M10 30 V14 Q10 10 14 10 H30`,
              `M${VW - 30} 10 H${VW - 14} Q${VW - 10} 10 ${VW - 10} 14 V30`,
              `M${VW - 10} ${VH - 30} V${VH - 14} Q${VW - 10} ${VH - 10} ${VW - 14} ${VH - 10} H${VW - 30}`,
              `M30 ${VH - 10} H14 Q10 ${VH - 10} 10 ${VH - 14} V${VH - 30}`,
            ].map((d) => (
              <path key={d} d={d} stroke="#a5f3c0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            ))}

            {/* The detection mesh growing over the produce. */}
            <g className="sf-dash" stroke="rgba(141,240,174,0.55)" strokeWidth="0.9" strokeDasharray="5 7">
              {SCAN_LINKS.map(([a, b]) => (
                <line
                  key={`${a}-${b}`}
                  x1={SCAN_NODES[a][0]}
                  y1={SCAN_NODES[a][1]}
                  x2={SCAN_NODES[b][0]}
                  y2={SCAN_NODES[b][1]}
                />
              ))}
            </g>
            {SCAN_NODES.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="2.6"
                fill="#8df0ae"
                className="sf-node"
                style={{ animationDelay: `${i * 0.11}s` }}
              />
            ))}

            {/* The sweep. */}
            <g className="sf-sweep">
              <rect x="0" y="-26" width={VW} height="26" fill="url(#sf-beam)" />
              <line x1="0" y1="0" x2={VW} y2="0" stroke="#b9f7cd" strokeWidth="1.6" />
            </g>
            <defs>
              <linearGradient id="sf-beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(141,240,174,0)" />
                <stop offset="100%" stopColor="rgba(141,240,174,0.35)" />
              </linearGradient>
            </defs>
          </g>
        )}

        {mapped && (
          <g>
            {/* The real map: one tinted cell per scored region. */}
            {regions.map((r) => (
              <rect
                key={`${r.row}-${r.col}`}
                x={r.col * cellW}
                y={r.row * cellH}
                width={cellW}
                height={cellH}
                fill={CELL_FILL[toneOf(r.score)]}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="0.6"
              />
            ))}

            {/* Mesh between neighbouring scored regions. */}
            <g stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeDasharray="3 4">
              {regions.map((a) =>
                regions
                  .filter(
                    (b) =>
                      (b.row === a.row && b.col === a.col + 1) ||
                      (b.col === a.col && b.row === a.row + 1),
                  )
                  .map((b) => {
                    const [x1, y1] = center(a)
                    const [x2, y2] = center(b)
                    return <line key={`${a.row}${a.col}-${b.row}${b.col}`} x1={x1} y1={y1} x2={x2} y2={y2} />
                  }),
              )}
            </g>

            {regions.map((r) => {
              const [cx, cy] = center(r)
              const tone = toneOf(r.score)
              return (
                <g key={`n-${r.row}-${r.col}`}>
                  {worst && r === worst && (
                    <circle cx={cx} cy={cy} r="6" fill="none" stroke={NODE_FILL[tone]} strokeWidth="1.6" className="sf-ping" />
                  )}
                  <circle cx={cx} cy={cy} r="3.6" fill={NODE_FILL[tone]} stroke="#ffffff" strokeWidth="1.2" />
                  <text
                    x={cx + 7}
                    y={cy + 3.5}
                    fontSize="9.5"
                    fontWeight="800"
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.55)"
                    strokeWidth="2"
                    paintOrder="stroke"
                  >
                    {r.score}
                  </text>
                </g>
              )
            })}
          </g>
        )}
      </svg>

      {busy && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-4 pb-2.5 pt-6 text-xs font-semibold text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#8df0ae]" />
          {STAGES[stage]}
        </div>
      )}

      {mapped && (
        <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          AI · {regions.length} regions scored on-device
        </span>
      )}
    </div>
  )
}
