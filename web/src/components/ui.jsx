import { Check } from 'lucide-react'

const ACCENTS = {
  green: 'cc-accent-green',
  blue: 'cc-accent-blue',
  amber: 'cc-accent-amber',
  red: 'cc-accent-red',
  none: '',
}

export function Card({ accent = 'none', className = '', children, ...rest }) {
  return (
    <div className={`cc-card ${ACCENTS[accent] ?? ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}

/**
 * Every functional label carries English and Hindi together - the design
 * system treats this as mandatory, not decorative.
 */
export function Bilingual({ en, hi, className = '', stacked = false }) {
  if (stacked) {
    return (
      <span className={`flex flex-col items-center leading-tight ${className}`}>
        <span className="font-semibold">{en}</span>
        <span className="text-[0.9em] font-medium opacity-90">{hi}</span>
      </span>
    )
  }
  return (
    <span className={className}>
      {en} <span className="opacity-90">/ {hi}</span>
    </span>
  )
}

const CHIP_TONES = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  green: 'bg-primary-fixed/60 text-primary',
  blue: 'bg-tertiary-fixed text-tertiary',
  amber: 'bg-secondary-fixed text-on-secondary-container',
  red: 'bg-error-container text-on-error-container',
}

export function Chip({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`cc-chip ${CHIP_TONES[tone]} ${className}`}>
      {Icon ? <Icon size={14} strokeWidth={2.5} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

const TILE_TONES = {
  green: { accent: 'cc-accent-green', badge: 'bg-primary text-on-primary' },
  blue: { accent: 'cc-accent-blue', badge: 'bg-tertiary-container text-on-tertiary' },
  amber: { accent: 'cc-accent-amber', badge: 'bg-secondary-container text-on-secondary-container' },
}

export function StatTile({ label, labelHi, value, sub, icon: Icon, tone = 'green' }) {
  const t = TILE_TONES[tone] ?? TILE_TONES.green
  return (
    <Card className={`${t.accent} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          {label} {labelHi ? <span className="normal-case">/ {labelHi}</span> : null}
        </p>
        {Icon ? (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${t.badge}`}>
            <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-sm text-on-surface-variant">{sub}</p> : null}
    </Card>
  )
}

export function SectionTitle({ en, hi, sub, className = '' }) {
  return (
    <div className={className}>
      <h2 className="text-2xl font-bold leading-tight tracking-tight">
        {en}
        {hi ? <span className="text-on-surface-variant"> / {hi}</span> : null}
      </h2>
      {sub ? <p className="mt-1.5 text-base text-on-surface-variant">{sub}</p> : null}
    </div>
  )
}

export function ProgressBar({ value, label, trailing, tone = 'green' }) {
  const pct = Math.max(0, Math.min(100, value))
  const fill = tone === 'blue' ? 'bg-tertiary-container' : 'bg-primary'
  return (
    <div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full rounded-full ${fill} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(label || trailing) && (
        <div className="mt-2 flex justify-between text-xs font-medium text-on-surface-variant">
          <span>{label}</span>
          <span>{trailing}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Column chart.
 *
 * The bar track is a `flex-1` box inside a column that the fixed-height row
 * stretches, which is what gives the bar's percentage height something
 * definite to resolve against - align the row itself to the end instead and
 * every bar silently collapses to zero.
 *
 * `pct` is supplied by the caller so each chart can pick its own scale.
 */
export function BarChart({ items, heightClass = 'h-44', gapClass = 'gap-2', ariaLabel }) {
  return (
    <div className={`flex ${heightClass} ${gapClass}`} role="img" aria-label={ariaLabel}>
      {items.map((it) => (
        <div key={it.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          {it.topLabel ? (
            <span className={`text-[10px] font-semibold ${it.topClass ?? 'text-on-surface-variant'}`}>
              {it.topLabel}
            </span>
          ) : null}

          <div className="relative flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t-sm transition-all duration-500 ${it.barClass ?? 'bg-primary'}`}
              style={{ height: `${Math.max(0, Math.min(100, it.pct))}%` }}
            />

            {/* Forecast uncertainty, drawn as a whisker over the column. */}
            {it.range && (
              <span
                className="pointer-events-none absolute left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-on-surface/35"
                style={{
                  bottom: `${Math.max(0, Math.min(100, it.range.low))}%`,
                  height: `${Math.max(0, Math.min(100, it.range.high - it.range.low))}%`,
                }}
                aria-hidden="true"
              />
            )}
          </div>

          {it.bottomLabel ? (
            <span className="text-xs font-medium text-on-surface-variant">{it.bottomLabel}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function Avatar({ name, size = 40, tone = 'green', highlight = false }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  const tones = {
    green: highlight ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
    blue: 'bg-tertiary-container text-on-tertiary',
    amber: 'bg-secondary-container text-on-secondary-container',
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${tones[tone] ?? tones.green}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}

/** Produce/warehouse imagery stand-in - gradient + glyph, zero external assets. */
export function ImageTile({ gradient = 'from-emerald-200 to-teal-100', glyph, height = 140, children }) {
  return (
    <div
      className={`relative flex items-end overflow-hidden rounded-t-md bg-gradient-to-br ${gradient}`}
      style={{ height }}
    >
      {glyph ? (
        <span
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none opacity-90"
          style={{ fontSize: height * 0.5, lineHeight: 1 }}
          aria-hidden="true"
        >
          {glyph}
        </span>
      ) : null}
      {children}
    </div>
  )
}

export function Bullet({ children }) {
  return (
    <li className="flex gap-2.5">
      <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}
