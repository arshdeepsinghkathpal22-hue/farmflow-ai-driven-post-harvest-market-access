// Indian-format helpers. Judges read ₹ in lakh, not thousands of thousands.

export function rupee(value, { decimals = 0 } = {}) {
  const n = Number(value) || 0
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function rupeeCompact(value) {
  const n = Number(value) || 0
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`
  return rupee(n)
}

export function kg(value) {
  const n = Number(value) || 0
  return `${n.toLocaleString('en-IN')} kg`
}

export function tempLabel([low, high]) {
  return `${low}-${high}°C`
}

export function dateShort(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
