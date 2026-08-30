import { Home, Snowflake, Truck, Users } from 'lucide-react'

/**
 * The cluster, drawn to relative distance.
 *
 * Same philosophy as RouteMap: an SVG rather than a tile map, because tiles
 * need a network round trip and an API key, and what matters here is where
 * things are *relative to the farm* - which facility is nearest, where the
 * pool members sit, where the truck is. Every position comes from the data
 * layer (`map: { x, y }` on the seed records), so a real deployment swaps in
 * registered coordinates without touching this component.
 */
const W = 380
const H = 240

function Pin({ x, y, tone, icon: Icon, label, sub, active, onClick }) {
  const fill = { green: '#2e6b34', blue: '#2b5f8a', amber: '#a3611a', slate: '#4b5563' }[tone] ?? '#2e6b34'
  return (
    <g
      transform={`translate(${x} ${y})`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={label}
    >
      {active && <circle r="17" fill={fill} opacity="0.22" />}
      <circle r="11" fill={fill} stroke="#ffffff" strokeWidth="2.5" />
      <Icon x={-6} y={-6} width={12} height={12} color="#ffffff" strokeWidth={2.6} />
      <text y="24" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#243428">
        {label}
      </text>
      {sub && (
        <text y="35" textAnchor="middle" fontSize="9" fontWeight="600" fill="#5c6e60">
          {sub}
        </text>
      )}
    </g>
  )
}

export default function ClusterMap({
  storages = [],
  highlightId = null,
  onSelectStorage,
  members = [],
  transporters = [],
  farm = null,
  routeTo = null,
  title,
}) {
  const dest = routeTo ? storages.find((s) => s.id === routeTo) : null

  return (
    <div className="relative overflow-hidden rounded-md bg-[#eef6e8]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={title ?? 'Cluster map'}>
        <defs>
          <linearGradient id="cm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f4e0" />
            <stop offset="100%" stopColor="#f4f8ea" />
          </linearGradient>
          <pattern id="cm-furrow" width="7" height="7" patternTransform="rotate(30)" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="#d7ead1" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#c6dfb2" strokeWidth="2.5" />
          </pattern>
        </defs>

        <rect width={W} height={H} fill="url(#cm-sky)" />
        <rect x="10" y="14" width="96" height="52" rx="7" fill="url(#cm-furrow)" opacity="0.8" />
        <rect x="272" y="30" width="92" height="56" rx="7" fill="url(#cm-furrow)" opacity="0.7" />
        <rect x="24" y="180" width="120" height="44" rx="7" fill="url(#cm-furrow)" opacity="0.8" />
        <rect x="252" y="196" width="110" height="34" rx="7" fill="url(#cm-furrow)" opacity="0.7" />
        {/* A road through the cluster, purely for orientation. */}
        <path d="M0 118 C 90 96, 160 152, 240 128 S 340 92, 380 104" stroke="#ffffff" strokeWidth="8" fill="none" opacity="0.9" />
        <path d="M0 118 C 90 96, 160 152, 240 128 S 340 92, 380 104" stroke="#cdb98f" strokeWidth="5" fill="none" strokeDasharray="1 9" strokeLinecap="round" />

        {/* Pickup lines: every member (and the farm) to the destination facility. */}
        {dest &&
          [...members.map((m) => m.map), farm].filter(Boolean).map((p, i) => (
            <line
              key={i}
              x1={p.x}
              y1={p.y}
              x2={dest.map.x}
              y2={dest.map.y}
              stroke="#2e6b34"
              strokeWidth="2"
              strokeDasharray="4 5"
              opacity="0.55"
            />
          ))}

        {storages.map((s) =>
          s.map ? (
            <Pin
              key={s.id}
              x={s.map.x}
              y={s.map.y}
              tone={s.slotsFree > 0 ? 'green' : 'slate'}
              icon={Snowflake}
              label={s.name.split(' ')[0]}
              sub={`${s.distanceKm} km · ${s.slotsFree > 0 ? `${s.slotsFree} slots` : 'full'}`}
              active={s.id === highlightId}
              onClick={onSelectStorage ? () => onSelectStorage(s.id) : undefined}
            />
          ) : null,
        )}

        {members.map((m) =>
          m.map ? (
            <Pin key={m.id} x={m.map.x} y={m.map.y} tone="blue" icon={Users} label={m.name} sub={`${m.qtyKg} kg`} />
          ) : null,
        )}

        {transporters.map((t) =>
          t.map ? <Pin key={t.id} x={t.map.x} y={t.map.y} tone="amber" icon={Truck} label={t.name.split(' ')[0]} /> : null,
        )}

        {farm && <Pin x={farm.x} y={farm.y} tone="amber" icon={Home} label="Your farm" />}
      </svg>

      <p className="px-3 py-2 text-[11px] leading-snug text-on-surface-variant">
        Drawn to relative distance from the data layer, not GPS tiles - so it works offline. Registered
        coordinates drop straight in.
      </p>
    </div>
  )
}
