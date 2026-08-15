// Decision logic behind the "AI" surfaces of the prototype.
// These are deterministic, explainable models running fully client side -
// the same interfaces a hosted ML service would expose in production.

import { CROPS, PRICE_SERIES, STORAGES, getCrop } from '../data/seed'

/**
 * Sell-or-store advisor.
 * Scans the forecast window for the best achievable price and weighs it
 * against storage cost and the crop's remaining shelf life.
 */
export function sellOrStore(cropId, quantityKg = 450, pricePerKgDay = 0.06) {
  const crop = getCrop(cropId)
  const series = PRICE_SERIES[cropId] ?? PRICE_SERIES.tomato
  const today = series[0]

  let bestDay = 0
  let bestNet = 0

  series.forEach((price, day) => {
    if (day > crop.shelfLifeDays) return
    const gross = (price - today) * quantityKg
    const storageCost = pricePerKgDay * quantityKg * day
    const net = gross - storageCost
    if (net > bestNet) {
      bestNet = net
      bestDay = day
    }
  })

  const peakPrice = series[bestDay]
  const pctChange = ((peakPrice - today) / today) * 100

  // Confidence falls off the further out the recommendation reaches.
  const horizonPenalty = bestDay * 2.5
  const confidence = Math.round(Math.max(55, Math.min(92, 92 - horizonPenalty)))

  const action = bestDay === 0 || bestNet <= 0 ? 'SELL' : 'STORE'

  // Uncertainty grows with the forecast horizon. Daily volatility is measured
  // from the series itself (standard deviation of day-on-day returns) and
  // widened by the square root of the number of days ahead, the usual random
  // walk assumption. Reported at roughly one standard deviation.
  const returns = series.slice(1).map((p, i) => (p - series[i]) / series[i])
  const mean = returns.reduce((s, r) => s + r, 0) / (returns.length || 1)
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length > 1 ? returns.length - 1 : 1)
  const dailyVol = Math.sqrt(variance)

  const band = series.map((price, day) => {
    const spread = price * dailyVol * Math.sqrt(day)
    return { day, price, low: price - spread, high: price + spread }
  })

  return {
    action,
    holdDays: bestDay,
    todayPrice: today,
    peakPrice,
    pctChange,
    confidence,
    expectedProfit: Math.max(0, Math.round(bestNet)),
    series,
    band,
    dailyVolPct: dailyVol * 100,
    shelfLifeDays: crop.shelfLifeDays,
  }
}

/**
 * Dynamic storage matching.
 * Scores each facility on temperature fit, distance, price and whether it
 * accepts micro-slots at all - the constraint that shuts small farmers out today.
 */
export function matchStorages(cropId, quantityKg = 120) {
  const crop = getCrop(cropId)
  const [idealLow, idealHigh] = crop.idealTemp

  const scored = STORAGES.map((storage) => {
    const [low, high] = storage.tempRange

    // Distance between the crop's ideal band and the facility's band.
    const tempGap =
      low > idealHigh ? low - idealHigh : high < idealLow ? idealLow - high : 0
    const tempScore = Math.max(0, 40 - tempGap * 12)

    const distanceScore = Math.max(0, 30 - storage.distanceKm * 3)
    const priceScore = Math.max(0, 30 - (storage.pricePerKgDay - 0.05) * 500)

    // A bulk-only facility simply cannot take a 120 kg lot on its own.
    const acceptsLot = storage.microSlots || quantityKg >= 450
    const penalty = acceptsLot ? 0 : 35

    const score = Math.round(tempScore + distanceScore + priceScore - penalty)

    return {
      ...storage,
      score,
      acceptsLot,
      tempGap,
      estimatedCost: Math.round(storage.pricePerKgDay * quantityKg * 6),
    }
  }).sort((a, b) => b.score - a.score)

  return scored
}

/**
 * Aggregation maths for a shared truck.
 * Transport is billed per trip, so each member's share falls as the pool grows.
 */
export function poolMath(pool, joined = false) {
  const othersKg = pool.members.reduce((sum, m) => sum + m.qtyKg, 0)
  const yourKg = pool.yourLotKg
  const totalKg = othersKg + (joined ? yourKg : 0)

  const fillPct = Math.min(100, (totalKg / pool.palletCapacityKg) * 100)
  const spaceLeftKg = Math.max(0, pool.palletCapacityKg - totalKg)
  const fullTruck = totalKg >= pool.palletCapacityKg

  // Transport is billed per trip, so each member pays by weight share.
  // Quoted against the pool as it stands once you are in it.
  const pooledKg = othersKg + yourKg
  const yourShare = pooledKg > 0 ? Math.round((yourKg / pooledKg) * pool.transportCostTotal) : 0

  // Hiring a vehicle alone carries a minimum charge no matter how small the lot.
  const savings = Math.max(0, pool.soloTransportCost - yourShare)

  return {
    othersKg,
    totalKg,
    yourKg,
    fillPct,
    spaceLeftKg,
    fullTruck,
    yourShare,
    savings,
    memberCount: pool.members.length + (joined ? 1 : 0),
    neighbourCount: pool.members.length,
  }
}

/**
 * Spoilage prediction - remaining shelf life once cold-chain time is counted.
 */
export function spoilage(cropId, daysStored = 0) {
  const crop = getCrop(cropId)
  const remaining = Math.max(0, crop.shelfLifeDays - daysStored)
  const urgency = remaining <= 2 ? 'critical' : remaining <= 4 ? 'warning' : 'ok'
  return { remaining, urgency, shelfLifeDays: crop.shelfLifeDays }
}

/**
 * Voice intent parsing.
 * Stands in for the speech-to-intent service: turns a spoken Hindi/Punjabi
 * phrase into a structured booking the farmer only has to confirm.
 */
export function parseVoice(sample) {
  const crop = getCrop(sample.cropId)
  const quantityKg = sample.crates * sample.kgPerCrate
  const matches = matchStorages(sample.cropId, quantityKg)
  const best = matches[0]

  return {
    crop,
    crates: sample.crates,
    quantityKg,
    pickup: sample.pickup,
    pickupHi: sample.pickupHi,
    storage: best,
    estimatedCost: best.estimatedCost,
  }
}

export const CROP_OPTIONS = CROPS
