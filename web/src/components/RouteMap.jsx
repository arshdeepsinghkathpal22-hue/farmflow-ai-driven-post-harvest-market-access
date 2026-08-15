import { Truck } from 'lucide-react'

/**
 * Illustrative pickup route for a pooled consignment.
 *
 * Drawn rather than mapped: a real tile map would need a network round trip and
 * an API key, and the point here is the shape of the trip - four farms on one
 * road, one truck - not the actual geography.
 */
export default function RouteMap({ stops, joined = false }) {
  // Positions follow the road curve below, spaced so labels never collide.
  const POINTS = [
    { x: 62, y: 150 },
    { x: 148, y: 96 },
    { x: 250, y: 132 },
    { x: 338, y: 74 },
  ]

  return (
    <div className="relative overflow-hidden rounded-md bg-[#eef6e8]">
      <svg viewBox="0 0 400 220" className="block w-full" role="img" aria-label="Pickup route across four farms">
        <defs>
          <linearGradient id="cc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f4e0" />
            <stop offset="100%" stopColor="#f4f8ea" />
          </linearGradient>
          <pattern id="cc-furrow" width="7" height="7" patternTransform="rotate(35)" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="#cfe6bd" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#bcd9a6" strokeWidth="2.5" />
          </pattern>
          <pattern id="cc-furrow-2" width="7" height="7" patternTransform="rotate(-20)" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="#dcecd0" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#c6dfb2" strokeWidth="2.5" />
          </pattern>
        </defs>

        <rect width="400" height="220" fill="url(#cc-sky)" />

        {/* Fields */}
        <rect x="8" y="18" width="104" height="62" rx="7" fill="url(#cc-furrow)" />
        <rect x="126" y="10" width="96" height="52" rx="7" fill="url(#cc-furrow-2)" />
        <rect x="238" y="20" width="86" height="46" rx="7" fill="url(#cc-furrow)" />
        <rect x="332" y="102" width="62" height="70" rx="7" fill="url(#cc-furrow-2)" />
        <rect x="12" y="176" width="120" height="36" rx="7" fill="url(#cc-furrow-2)" />
        <rect x="176" y="164" width="130" height="48" rx="7" fill="url(#cc-furrow)" />

        {/* Water */}
        <path
          d="M0 96 C 46 84, 74 118, 118 112 S 190 78, 236 92 S 320 128, 400 108"
          stroke="#a9d3ea"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* The truck route */}
        <path
          d="M62 150 C 96 150, 112 96, 148 96 S 214 132, 250 132 S 306 74, 338 74"
          stroke="#ffffff"
          strokeWidth="11"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M62 150 C 96 150, 112 96, 148 96 S 214 132, 250 132 S 306 74, 338 74"
          stroke="#1b7a43"
          strokeWidth="3"
          strokeDasharray="7 7"
          fill="none"
          strokeLinecap="round"
        />

        {/* Stops */}
        {stops.map((s, i) => {
          const p = POINTS[i] ?? POINTS[POINTS.length - 1]
          const mine = s.isYou
          const pending = mine && !joined
          return (
            <g key={s.id}>
              <ellipse cx={p.x} cy={p.y + 15} rx="11" ry="3.5" fill="#000" opacity="0.12" />
              <circle
                cx={p.x}
                cy={p.y}
                r="13"
                fill={pending ? '#ffffff' : mine ? '#006030' : '#1b7a43'}
                stroke={pending ? '#006030' : '#ffffff'}
                strokeWidth={pending ? 2.5 : 3}
                strokeDasharray={pending ? '4 3' : undefined}
              />
              <text
                x={p.x}
                y={p.y + 4.5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill={pending ? '#006030' : '#ffffff'}
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>

      <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-surface-container-lowest/95 px-3.5 py-2 text-sm font-semibold text-primary shadow-card">
        <Truck size={16} strokeWidth={2.5} aria-hidden="true" />
        Pickup Route
      </span>
    </div>
  )
}
