/**
 * The decision engine.
 *
 * Freshness on its own is a number. A price forecast on its own is a chart.
 * Neither tells a farmer what to do. This module joins them:
 *
 *     what the produce is  (vision)
 *   x how long it will last (vision)
 *   x what the price will do (forecast)
 *   - what storage costs    (facility rate)
 *   = the day that earns the most, and how much more than selling today
 *
 * It is an expected-value calculation over a bounded horizon, constrained by
 * the shelf life the photograph implied. That constraint is what makes the two
 * halves inseparable: the same price curve produces a different answer for a
 * fresh lot and a bruised one.
 */

import { PRICE_SERIES, getCrop } from '../data/seed.js'

/**
 * Cold storage does not stop decay, it slows it.
 *
 * Roughly four times slower is the figure the cold-chain literature uses for
 * most vegetables between 2 and 4 degrees, and it is deliberately conservative:
 * over-promising shelf life is how a farmer ends up with a rotten consignment
 * and no trust in the platform.
 */
const COLD_SLOWDOWN = 4

/** Produce held at room temperature past its remaining life is unsellable. */
function sellableFraction(daysHeld, remainingDays, { cold }) {
  const effectiveLife = remainingDays * (cold ? COLD_SLOWDOWN : 1)
  if (effectiveLife <= 0) return 0
  const used = daysHeld / effectiveLife

  // Loss is slow at first and accelerates - the last day costs far more than
  // the first, which is why waiting one day too long is expensive.
  const loss = Math.min(1, used ** 1.6)
  return Math.max(0, 1 - loss)
}

/**
 * Decide what to do with a lot.
 *
 * `freshness` and `remainingDays` come from the photograph; everything else
 * from the crop and the facility. Returns the winning action plus the full day
 * by day working, so the screen can show why.
 */
export function decideForLot({
  cropId,
  remainingDays,
  quantityKg = 100,
  ratePaisePerKgDay = 6,
  horizonDays = 6,
}) {
  const crop = getCrop(cropId)
  const series = PRICE_SERIES[cropId] ?? PRICE_SERIES.tomato
  const today = series[0]
  const qty = Number(quantityKg) || 0
  const ratePerKgDay = ratePaisePerKgDay / 100

  const horizon = Math.min(horizonDays, series.length - 1)

  const options = []
  for (let day = 0; day <= horizon; day += 1) {
    const price = series[day]
    const cold = day > 0

    const fraction = sellableFraction(day, remainingDays, { cold })
    const sellableKg = qty * fraction
    const revenue = sellableKg * price
    const storageCost = cold ? ratePerKgDay * qty * day : 0
    const net = revenue - storageCost

    options.push({
      day,
      price,
      sellablePct: Math.round(fraction * 100),
      sellableKg: Math.round(sellableKg * 10) / 10,
      revenue: Math.round(revenue),
      storageCost: Math.round(storageCost),
      net: Math.round(net),
    })
  }

  const sellToday = options[0]
  const best = options.reduce((a, b) => (b.net > a.net ? b : a), options[0])
  const gain = best.net - sellToday.net

  // A trivial gain is not worth a truck, a booking and six days of worry.
  const worthIt = best.day > 0 && gain > Math.max(50, sellToday.net * 0.03)

  return {
    crop,
    action: worthIt ? 'STORE' : 'SELL_TODAY',
    holdDays: worthIt ? best.day : 0,
    todayPrice: today,
    bestPrice: best.price,
    sellTodayNet: sellToday.net,
    bestNet: best.net,
    gain: worthIt ? gain : 0,
    gainPct: sellToday.net > 0 ? Math.round((gain / sellToday.net) * 100) : 0,
    quantityKg: qty,
    remainingDays,
    options,
    // Named so the screen can explain the refusal rather than just showing a verdict.
    reason: worthIt
      ? 'holding earns more than it costs'
      : remainingDays < 2
        ? 'this lot will not survive storage'
        : 'the price gain would not cover the storage cost',
  }
}

/** Wording for each verdict, in the language the farmer chose. */
export const DECISION_COPY = {
  STORE: {
    en: (d) => `Store for ${d.holdDays} days and earn about ₹${d.gain.toLocaleString('en-IN')} more`,
    hi: (d) => `${d.holdDays} दिन स्टोर करें, लगभग ₹${d.gain.toLocaleString('en-IN')} ज़्यादा मिलेंगे`,
    pa: (d) => `${d.holdDays} ਦਿਨ ਸਟੋਰ ਕਰੋ, ਲਗਭਗ ₹${d.gain.toLocaleString('en-IN')} ਵੱਧ ਮਿਲਣਗੇ`,
  },
  SELL_TODAY: {
    en: () => 'Sell today - storing would not pay for itself',
    hi: () => 'आज ही बेचें - स्टोर करने का ख़र्च वसूल नहीं होगा',
    pa: () => 'ਅੱਜ ਹੀ ਵੇਚੋ - ਸਟੋਰ ਕਰਨ ਦਾ ਖ਼ਰਚ ਵਸੂਲ ਨਹੀਂ ਹੋਵੇਗਾ',
  },
}

export function decisionHeadline(decision, lang = 'en') {
  const copy = DECISION_COPY[decision.action]
  return (copy[lang] ?? copy.en)(decision)
}
