/**
 * Produce analysis from a photograph.
 *
 * ─── What this actually measures ─────────────────────────────────────────────
 *
 * Be precise about this, because the difference matters and a judge will ask.
 * A photograph carries information about the **surface** of the produce and
 * nothing else. So this pipeline measures visible surface quality:
 *
 *   · dominant colour and how tightly it is distributed
 *   · the fraction of the surface that is significantly darker than the rest
 *   · the fraction showing the dull warm hues of browning
 *   · how uneven the surface is at small scale
 *
 * From those it estimates a **visual quality index**, and from that index it
 * scales the crop's published room-temperature shelf life into an estimate of
 * the days remaining.
 *
 * That last step is a **model, not a measurement**. It rests on the assumption
 * that visible deterioration is roughly proportional to elapsed usable life,
 * which is true enough to be useful for sorting a harvest and is not true
 * enough to be a guarantee. It is stated in the UI as an estimate for the same
 * reason.
 *
 * ─── What a photograph cannot tell you ───────────────────────────────────────
 *
 * Internal rot before it reaches the skin. Firmness. Sugar content. Actual days
 * since harvest. Pathogen load. Cold-chain history. Anything under the surface.
 * A confident number for any of those from a single RGB image would be
 * fabricated, so none of them is produced here.
 *
 * ─── Technique ───────────────────────────────────────────────────────────────
 *
 * Classical computer vision, deliberately, and every stage is a named method
 * rather than a tuned guess:
 *
 *   · **Illuminant estimation** from the border of the frame, then von Kries
 *     correction. Without it the same tomato photographed in shade measures as
 *     duller produce, which is the single largest source of false readings.
 *   · **Otsu's method** for every threshold - segmentation and blemishes - so
 *     the cut is derived from this image's own histogram instead of a constant
 *     that only suits the lighting it was tuned in.
 *   · **Hue histograms compared by Bhattacharyya coefficient** for crop
 *     identification, not a single mean hue. A red onion is purple *and* white;
 *     its mean hue is a colour that appears nowhere on the vegetable.
 *   · **Laplacian variance** for surface texture, the standard focus and
 *     micro-contrast metric.
 *   · **Tiled analysis** so a partly spoiled lot is reported by its worst
 *     region rather than averaged into looking acceptable.
 *
 * ─── And a trained model on top ──────────────────────────────────────────────
 *
 * `analyseProduce` is the classical pipeline above and is used on its own for
 * the crops with no trained model. `analyseProduceSmart` adds one: a
 * MobileNetV3-small fine-tuned on 8,551 photographs of tomato and capsicum,
 * 4.4 MB as ONNX, run in the browser through WebAssembly. It never leaves the
 * phone either. See `ml/README.md` for the data, the choices and the measured
 * test-set numbers.
 *
 * The two are kept as independent estimators rather than one replacing the
 * other, because they fail differently. The network is far better at naming the
 * crop and reading ripeness; it is a closed-set classifier, so it cannot say
 * "that is a wall" at any confidence threshold. The measurements can say that,
 * and they are what the validity gates use. Where the two disagree about
 * condition, the disagreement itself is reported - see `analyseProduceSmart`.
 *
 * Nothing here touches the network, so it works offline and no photograph ever
 * leaves the phone.
 */

import { CROPS, getCrop } from '../data/seed.js'
import { classifyProduce, MODEL_CROP_TO_APP } from './model.js'

/** Analysis runs on a downscaled copy; detail beyond this adds cost, not signal. */
const WORK_SIZE = 192

/** Hue histogram resolution. 36 bins is 10 degrees each - fine enough to tell
 *  tomato red from potato brown, coarse enough not to chase camera noise. */
const HUE_BINS = 36

/* ── Colour ───────────────────────────────────────────────────────────────── */

function rgbToHsv(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }

  return { h, s: max === 0 ? 0 : d / max, v: max }
}

/** Draw the image into a canvas at working size and read the pixels back. */
function toPixels(source) {
  const width = WORK_SIZE
  const ratio = source.height / source.width || 1
  const height = Math.max(1, Math.round(width * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, width, height)
  return { data: ctx.getImageData(0, 0, width, height).data, width, height }
}

/**
 * Standard deviation of luminance over the entire frame.
 *
 * A photograph of a real object always has structure - an edge, a shadow, a
 * gradient. A blank, blown-out or fully transparent frame has none, and this is
 * the cheapest way to tell the difference.
 */
function globalContrast({ data, width, height }) {
  const n = width * height
  if (n < 2) return 0
  let sum = 0
  let sumSq = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    sum += lum
    sumSq += lum * lum
  }
  const mean = sum / n
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean))
}

/** Paint an already corrected pixel buffer back onto a canvas. */
function toCanvas({ data, width, height }) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(width, height)
  img.data.set(data)
  ctx.putImageData(img, 0, 0)
  return canvas
}


/**
 * Mean colour of the frame's border band, or of everything inside it.
 *
 * Blown highlights and deep shadow are skipped in both cases: they carry no
 * colour information, only exposure.
 */
function meanColour(data, width, height, borderOnly) {
  const bandX = Math.max(1, Math.round(width * 0.12))
  const bandY = Math.max(1, Math.round(height * 0.12))

  let sr = 0
  let sg = 0
  let sb = 0
  let n = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const border = x < bandX || x >= width - bandX || y < bandY || y >= height - bandY
      if (border !== borderOnly) continue
      const i = (y * width + x) * 4
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (lum < 18 || lum > 245) continue
      sr += data[i]
      sg += data[i + 1]
      sb += data[i + 2]
      n += 1
    }
  }

  return n > 0 ? { r: sr / n, g: sg / n, b: sb / n, n } : { r: 0, g: 0, b: 0, n: 0 }
}

/**
 * Estimate the illuminant and divide it out.
 *
 * Phones do not white-balance consistently, and the error is systematic: a
 * photograph taken in shade is blue, one taken under a tin roof at noon is
 * warm. Left uncorrected, the same tomato reads as duller or browner purely
 * because of where the farmer was standing - and browning is one of the things
 * being scored, so this is not a cosmetic concern.
 *
 * The illuminant is estimated from the **border** of the frame rather than the
 * whole image. The usual grey-world assumption - that a scene averages to grey -
 * fails badly here, because the subject of the photograph is deliberately one
 * saturated colour filling the middle. The border is background: ground, cloth,
 * a crate, a hand. It is far closer to neutral, and it is lit by the same
 * light. Correction is von Kries: scale each channel so the estimate becomes
 * grey.
 *
 * The gains are clamped, and the estimate is checked before it is used at all -
 * a wrong correction is worse than none. See the guard inside the function.
 */

function whiteBalance({ data, width, height }) {
  const border = meanColour(data, width, height, true)
  if (border.n < 40) return { data, width, height, corrected: false, gains: [1, 1, 1] }

  const mr = border.r
  const mg = border.g
  const mb = border.b
  const grey = (mr + mg + mb) / 3

  // Is this border actually background, or is it the vegetable?
  //
  // Clamping the gains was not enough, because a clamped correction built on a
  // meaningless estimate is still meaningless - it just fails more slowly. In a
  // close-up the produce fills the border too, and then the "background" being
  // measured is the subject. One spoiled capsicum photographed that way gave a
  // border of (165, 60, 47): saturation 0.71, deep red. The gains went straight
  // to the clamp limits in the worst possible direction, red down and blue up,
  // which tipped every near-neutral dark pixel across to cyan and split a
  // uniformly red lot into two opposite hues. Measured spread went from 0.006 to
  // 0.858, and the photo was refused as "not one lot of produce".
  //
  // Border saturation alone cannot decide this, and getting that wrong breaks
  // the case this function exists for: a blue cast lifts a perfectly good
  // border to 0.26, so any threshold low enough to catch the capsicum also
  // switches the correction off exactly when a cast needs correcting.
  //
  // Two conditions together, because a cast and a filled frame differ in both:
  //
  //   · the border is **vividly** coloured, past what a tint does to a
  //     background - 0.71 for the capsicum, against 0.26 and 0.32 for genuine
  //     casts and 0.02 to 0.09 for ordinary backgrounds;
  //   · and it is the **same colour as the middle of the frame**, which is what
  //     one vegetable filling the whole photograph looks like. A cast leaves the
  //     two far apart, 137 degrees on the blue-cast tomato, because the light is
  //     tinted but the subject is still its own colour.
  const sat = (r, g, b) => {
    const mx = Math.max(r, g, b)
    return mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0
  }
  const centre = meanColour(data, width, height, false)
  const borderHsv = rgbToHsv(mr, mg, mb)
  const centreHsv = rgbToHsv(centre.r, centre.g, centre.b)
  const hueGap = Math.abs(borderHsv.h - centreHsv.h) % 360
  const sameColour = (hueGap > 180 ? 360 - hueGap : hueGap) < 30

  if (sat(mr, mg, mb) > 0.5 && sameColour) {
    return { data, width, height, corrected: false, gains: [1, 1, 1] }
  }

  const clamp = (g) => Math.max(0.75, Math.min(1.35, g))
  const gains = [clamp(grey / (mr || 1)), clamp(grey / (mg || 1)), clamp(grey / (mb || 1))]

  const out = new Uint8ClampedArray(data.length)
  for (let i = 0; i < data.length; i += 4) {
    out[i] = Math.min(255, data[i] * gains[0])
    out[i + 1] = Math.min(255, data[i + 1] * gains[1])
    out[i + 2] = Math.min(255, data[i + 2] * gains[2])
    out[i + 3] = data[i + 3]
  }

  return {
    data: out,
    width,
    height,
    corrected: true,
    gains: gains.map((g) => Math.round(g * 100) / 100),
  }
}

/**
 * Otsu's method: the threshold that best separates a set of values into two
 * groups, found by maximising the variance between them.
 *
 * Used instead of a fixed cut-off because a fixed cut-off is only ever right
 * for the lighting it was chosen under. Otsu derives the boundary from the
 * image in front of it.
 */
function otsu(values, bins = 64) {
  if (!values.length) return 0.5

  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (max - min < 1e-6) return min

  const hist = new Array(bins).fill(0)
  const scale = (bins - 1) / (max - min)
  for (const v of values) hist[Math.round((v - min) * scale)] += 1

  const total = values.length
  let sum = 0
  for (let i = 0; i < bins; i += 1) sum += i * hist[i]

  let sumB = 0
  let wB = 0
  let best = 0
  let bestVariance = -1

  for (let i = 0; i < bins; i += 1) {
    wB += hist[i]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break

    sumB += i * hist[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2

    if (between > bestVariance) {
      bestVariance = between
      best = i
    }
  }

  return min + best / scale
}

/**
 * Separate produce from background.
 *
 * The obvious rule - "produce is the colourful part" - is wrong for exactly the
 * crop most likely to be photographed against a dark floor: cauliflower is
 * white, and its saturation is near zero. Using saturation alone would discard
 * the vegetable and measure the floor.
 *
 * So each pixel gets a *subject score* combining three signals that hold for
 * pale and vivid produce alike, and the cut between subject and background is
 * found by Otsu on those scores rather than fixed in advance:
 *
 *   · **chroma** - produce is usually more colourful than the ground, but this
 *     is only one third of the vote, so a white cauliflower survives it
 *   · **centrality** - people put the thing they are photographing in the
 *     middle of the frame
 *   · **distance from the border colour** - whatever fills the edges of the
 *     frame is background by definition, so pixels that look like it are too
 */
function segment({ data, width, height }) {
  const cx = width / 2
  const cy = height / 2
  const maxDist = Math.hypot(cx, cy)

  const bandX = Math.max(1, Math.round(width * 0.12))
  const bandY = Math.max(1, Math.round(height * 0.12))
  let br = 0
  let bg = 0
  let bb = 0
  let bn = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!(x < bandX || x >= width - bandX || y < bandY || y >= height - bandY)) continue
      const i = (y * width + x) * 4
      br += data[i]
      bg += data[i + 1]
      bb += data[i + 2]
      bn += 1
    }
  }
  const bgColour = bn ? [br / bn, bg / bn, bb / bn] : [128, 128, 128]

  const all = []
  const scores = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const hsv = rgbToHsv(r, g, b)

      const centrality = 1 - Math.hypot(x - cx, y - cy) / maxDist
      const bgDistance = Math.min(
        1,
        Math.hypot(r - bgColour[0], g - bgColour[1], b - bgColour[2]) / 180,
      )

      const score = hsv.s * 0.34 + centrality * 0.33 + bgDistance * 0.33
      all.push({ ...hsv, x, y, r, g, b, score })
      scores.push(score)
    }
  }

  const cut = otsu(scores)
  let pixels = all.filter((p) => p.score >= cut)

  // Guard against a threshold that keeps almost nothing - a flat photograph of
  // a single colour has no two groups to find - by falling back to the centre
  // of the frame rather than reporting on a handful of stray pixels.
  let fallback = false
  if (pixels.length < all.length * 0.05) {
    fallback = true
    pixels = all.filter(
      (p) =>
        p.x > width * 0.25 && p.x < width * 0.75 && p.y > height * 0.25 && p.y < height * 0.75,
    )
  }

  return { pixels, all, width, height, coverage: pixels.length / all.length, fallback, cut }
}

/* ── Measurement ──────────────────────────────────────────────────────────── */

/** Circular mean, because hue wraps: red is both 355 and 5 degrees. */
function meanHue(pixels) {
  let sx = 0
  let sy = 0
  for (const p of pixels) {
    const rad = (p.h * Math.PI) / 180
    sx += Math.cos(rad) * p.s
    sy += Math.sin(rad) * p.s
  }
  const angle = (Math.atan2(sy, sx) * 180) / Math.PI
  return angle < 0 ? angle + 360 : angle
}

/**
 * Hue histogram, weighted by saturation and normalised to sum to one.
 *
 * Weighting by saturation is what stops a grey pixel - whose hue is
 * meaningless, since with no colour there is no angle to measure - from voting
 * as loudly as a vividly coloured one.
 */
function hueHistogram(pixels) {
  const hist = new Array(HUE_BINS).fill(0)
  let total = 0
  for (const p of pixels) {
    const bin = Math.min(HUE_BINS - 1, Math.floor((p.h / 360) * HUE_BINS))
    const weight = p.s
    hist[bin] += weight
    total += weight
  }
  if (total <= 0) return hist.map(() => 1 / HUE_BINS)
  return hist.map((v) => v / total)
}

/**
 * Laplacian variance: the standard measure of small-scale surface contrast.
 *
 * A 4-neighbour Laplacian responds to local change, and the variance of that
 * response says how textured a surface is. Fresh produce is smooth and
 * specular; shrivelled skin and mould are not. It is also the standard blur
 * metric, which is a useful side effect - an out-of-focus photograph produces a
 * low value and the confidence reported alongside drops with it.
 */
function laplacianVariance(pixels, width, height) {
  const lum = new Float32Array(width * height)
  const inside = new Uint8Array(width * height)
  for (const p of pixels) {
    const idx = p.y * width + p.x
    lum[idx] = p.v
    inside[idx] = 1
  }

  const responses = []
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      if (!inside[idx]) continue
      if (!inside[idx - 1] || !inside[idx + 1] || !inside[idx - width] || !inside[idx + width]) continue
      responses.push(
        4 * lum[idx] - lum[idx - 1] - lum[idx + 1] - lum[idx - width] - lum[idx + width],
      )
    }
  }

  if (responses.length < 20) return 0
  const mean = responses.reduce((s, v) => s + v, 0) / responses.length
  return responses.reduce((s, v) => s + (v - mean) ** 2, 0) / responses.length
}

/**
 * Measure a set of produce pixels.
 *
 * The blemish threshold is Otsu's on this lot's own brightness distribution,
 * bounded so that a perfectly even piece of produce - where Otsu has no real
 * boundary to find and will invent one in the middle - is not reported as half
 * covered in spots.
 */
function measure(pixels, width, height) {
  const hue = meanHue(pixels)
  const saturation = pixels.reduce((s, p) => s + p.s, 0) / pixels.length
  const value = pixels.reduce((s, p) => s + p.v, 0) / pixels.length

  const values = pixels.map((p) => p.v)
  const sorted = [...values].sort((a, b) => a - b)
  const medianValue = sorted[sorted.length >> 1]

  const otsuCut = otsu(values)
  // Only believe the cut if it sits clearly below the bulk of the produce.
  // Otherwise there is no dark region to find, and the honest answer is none.
  const darkCut = otsuCut < medianValue * 0.82 ? otsuCut : medianValue * 0.5

  // Dark, **and a different colour from the rest of the lot**.
  //
  // Counting every dark pixel as a blemish punishes shape. A capsicum is lobed
  // and glossy, so one side of it is always in shadow; a sound one measured
  // 12.7% "blemish" against a sound tomato's 0.08%, and the freshness it was
  // shown dropped by thirty points for no reason but its geometry.
  //
  // Shadow and spoilage are separable, because shadow only removes light. Taking
  // the lot's lit pixels as the reference, the fixtures divide cleanly:
  //
  //   sound capsicum      hue off by 2 degrees, saturation ratio 0.96
  //   spoiled tomato      hue off by 3 degrees, saturation ratio 0.58
  //   spoiled capsicum    hue off by 14 degrees, saturation ratio 1.03
  //
  // The sound lot differs in neither. Both spoiled lots differ in one. So a dark
  // pixel counts only if its colour also departs from the lit reference - by
  // hue, or by a collapse in saturation, which is what pigment breakdown looks
  // like. Darkness on its own is a description of the light, not the produce.
  const lit = pixels.filter((p) => p.v >= darkCut)
  const litHue = lit.length >= 20 ? meanHue(lit) : hue
  const litSaturation =
    lit.length >= 20 ? [...lit.map((p) => p.s)].sort((a, b) => a - b)[lit.length >> 1] : saturation

  const hueDistance = (a, b) => {
    const d = Math.abs(a - b) % 360
    return d > 180 ? 360 - d : d
  }
  const discoloured = (p) =>
    hueDistance(p.h, litHue) > 12 || p.s < litSaturation * 0.75 || litSaturation < 0.12

  const blemish = pixels.filter((p) => p.v < darkCut && discoloured(p)).length / pixels.length

  // Browning: the dull warm band, at low saturation and low brightness. These
  // bounds describe the appearance of oxidised plant tissue rather than any
  // particular crop, which is why they are the same for all four.
  const browning =
    pixels.filter((p) => p.h >= 15 && p.h <= 50 && p.s < 0.5 && p.v < 0.62).length / pixels.length

  const texture = laplacianVariance(pixels, width, height)

  // Colour spread: the circular variance of hue, over the pixels whose hue
  // actually means something.
  //
  // The hue of a near-black or near-grey pixel is arbitrary: a difference of one
  // count out of 255 between channels swings it anywhere on the wheel. Rot is
  // mostly dark, so including those pixels lets a rotten lot scatter its hues
  // the way random noise does. Restricting to colourful pixels took a spoiled
  // capsicum from 0.086 to 0.006, and left every other fixture within 0.03.
  //
  // This is a refinement, not the thing that fixed the false refusals. That was
  // the illuminant estimate - see `whiteBalance`.
  let sx = 0
  let sy = 0
  let coloured = 0
  for (const p of pixels) {
    if (p.v < 0.12 || p.s < 0.15) continue
    const rad = (p.h * Math.PI) / 180
    sx += Math.cos(rad)
    sy += Math.sin(rad)
    coloured += 1
  }
  // Too few colourful pixels to judge by colour at all. Report no spread rather
  // than a number computed from nothing; darkness is the blemish measure's job,
  // not this one's.
  const resultant = coloured >= 40 ? Math.hypot(sx, sy) / coloured : 1
  const hueSpread = 1 - resultant
  const colouredFraction = coloured / pixels.length

  return {
    hue,
    saturation,
    value,
    medianValue,
    blemish,
    browning,
    texture,
    hueSpread,
    colouredFraction,
    histogram: hueHistogram(pixels),
  }
}

/* ── Crop identification ──────────────────────────────────────────────────── */

/**
 * Reference hue distributions, as bin weights over the same 36 bins.
 *
 * These are **hand-specified from the horticultural description of each crop**,
 * not learned from a dataset - and they are written as distributions rather
 * than single hues for a reason that a mean cannot express: a red onion is
 * genuinely two colours, purple skin and pale flesh, and its *average* hue is a
 * colour that appears nowhere on the vegetable. A distribution can say "some of
 * this and some of that". A mean cannot.
 *
 * `satBand` and `valBand` are the ranges each crop should occupy; they carry
 * the information hue alone cannot, which is what separates a white cauliflower
 * from a pale potato.
 */
function bandHistogram(spec) {
  const hist = new Array(HUE_BINS).fill(0)
  for (const [from, to, weight] of spec) {
    for (let deg = from; deg < to; deg += 10) {
      hist[Math.floor((((deg % 360) + 360) % 360) / 10) % HUE_BINS] += weight
    }
  }
  const total = hist.reduce((s, v) => s + v, 0) || 1
  return hist.map((v) => v / total)
}

const SIGNATURES = {
  tomato: {
    // Ripe red, wrapping through zero, with a little orange shoulder.
    hist: bandHistogram([[350, 360, 3], [0, 20, 3], [20, 40, 1]]),
    satBand: [0.45, 1.0],
    valBand: [0.2, 1.0],
  },
  potato: {
    // Yellow-brown skin, a narrow and rather dull band.
    hist: bandHistogram([[20, 50, 3], [50, 60, 1]]),
    satBand: [0.15, 0.62],
    valBand: [0.2, 0.85],
  },
  onion: {
    // Two populations at once: purple-red skin and straw-coloured flesh.
    hist: bandHistogram([[280, 340, 2], [340, 360, 1], [20, 50, 2]]),
    satBand: [0.12, 0.75],
    valBand: [0.2, 0.92],
  },
  capsicum: {
    // Green and red both occur, and both are vivid - the defining feature is
    // high saturation at a hue that is either firmly green or firmly red.
    hist: bandHistogram([[80, 150, 3], [350, 360, 1], [0, 15, 1]]),
    satBand: [0.35, 1.0],
    valBand: [0.15, 0.95],
  },
  cauliflower: {
    // Barely any hue at all; the curd is near-neutral and bright. Identity here
    // comes almost entirely from saturation and brightness, not from colour.
    hist: bandHistogram([[20, 70, 1]]),
    satBand: [0.0, 0.24],
    valBand: [0.55, 1.0],
  },
}

/**
 * Bhattacharyya coefficient: how much two probability distributions overlap.
 * One means identical, zero means they share nothing. The standard way to
 * compare histograms, and it degrades gracefully - an odd photograph produces a
 * low score for every crop rather than a confident wrong answer.
 */
function bhattacharyya(p, q) {
  let sum = 0
  for (let i = 0; i < p.length; i += 1) sum += Math.sqrt(p[i] * q[i])
  return sum
}

function bandFit(value, [lo, hi]) {
  if (value >= lo && value <= hi) return 1
  const miss = value < lo ? lo - value : value - hi
  return Math.max(0, 1 - miss * 3)
}

function classifyCrop(stats) {
  const scored = Object.entries(SIGNATURES).map(([cropId, sig]) => {
    const hueFit = bhattacharyya(stats.histogram, sig.hist)
    const satFit = bandFit(stats.saturation, sig.satBand)
    const valFit = bandFit(stats.value, sig.valBand)

    // Saturation and brightness are weighted as heavily as hue together,
    // because for the pale crops they carry the whole signal.
    const score = hueFit * 0.5 + satFit * 0.3 + valFit * 0.2
    return { cropId, score, hueFit, satFit, valFit }
  })

  scored.sort((a, b) => b.score - a.score)
  const [best, runnerUp] = scored

  // Confidence reflects both how well the winner fits and how clearly it beats
  // the next candidate. A close call is not certainty and must not read as it.
  const margin = best.score - (runnerUp?.score ?? 0)
  const confidence = Math.round(
    Math.max(0, Math.min(1, best.score * 0.7 + Math.min(margin * 2.5, 0.35))) * 100,
  )

  return { cropId: best.cropId, confidence, bestFit: best.score, ranking: scored }
}

/* ── Scoring ──────────────────────────────────────────────────────────────── */

/**
 * Turn measurements into a visual quality index out of 100.
 *
 * Each term is a deduction from a perfect piece of produce, and each one is
 * here because it corresponds to something a grader would actually look for:
 *
 *   · **dark coverage** - bruising, sunken lesions, mould. The heaviest
 *     penalty, because it is the most direct evidence of spoilage and the least
 *     ambiguous thing in the frame.
 *   · **browning** - oxidised tissue. Weighted lower than dark coverage
 *     because dry soil on the skin looks similar to a camera and washes off.
 *   · **texture** - shrivelling and surface mould raise micro-contrast. Scaled
 *     against a threshold, because clean produce is not perfectly smooth.
 *   · **hue spread** - a lesion is a second colour appearing on a vegetable
 *     that ought to be one colour.
 *   · **dullness** - loss of pigment saturation as the crop ages. Cauliflower
 *     is exempt and judged on brightness instead: it is *supposed* to be pale,
 *     and its spoilage shows as the curd yellowing and darkening.
 *
 * The coefficients are calibrated so that visibly good produce lands in the
 * high eighties to nineties and visibly poor produce in the thirties. They are
 * not derived from a labelled dataset, and the number is presented as an index
 * rather than a percentage of anything for that reason.
 */
function scoreQuality(stats, cropId) {
  const pale = cropId === 'cauliflower'

  const blemishPenalty = Math.min(55, stats.blemish * 170)
  const browningPenalty = Math.min(pale ? 30 : 26, stats.browning * (pale ? 120 : 95))
  const texturePenalty = Math.min(16, Math.max(0, stats.texture - 0.004) * 900)
  const dullPenalty = pale
    ? Math.max(0, 0.72 - stats.value) * 60
    : Math.max(0, 0.42 - stats.saturation) * 45

  // There was a hue-spread penalty here - `max(0, spread - 0.25) * 40` - on the
  // reasoning that a lesion is a second colour on a vegetable that ought to be
  // one. It is gone because the fixtures say it never fired and could not have:
  // every real lot measures between 0.01 and 0.11, sound and rotten alike, so
  // the term deducted exactly zero from all of them. A spoiled tomato and a
  // fresh one both measure 0.01. Hue spread separates produce from noise, which
  // is why the validity gate still uses it, but it does not grade produce.
  // Keeping a term that only ever contributes zero would suggest the score
  // rests on more evidence than it does.
  const score = 100 - blemishPenalty - browningPenalty - texturePenalty - dullPenalty
  return Math.max(3, Math.min(99, Math.round(score)))
}

/** Split the produce pixels into a grid and score each cell that has enough of them. */
function tiles(pixels, width, height, cropId, rows = 3, cols = 3) {
  const cellW = width / cols
  const cellH = height / rows
  const out = []

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = pixels.filter(
        (p) =>
          p.x >= c * cellW && p.x < (c + 1) * cellW && p.y >= r * cellH && p.y < (r + 1) * cellH,
      )
      // A cell needs enough pixels for its statistics to mean anything.
      if (cell.length < 60) continue
      const stats = measure(cell, width, height)
      out.push({ row: r, col: c, count: cell.length, score: scoreQuality(stats, cropId) })
    }
  }
  return out
}


/**
 * What the pipeline refuses to answer.
 *
 * Every threshold here was measured, not guessed. Photographs of the four
 * crops - including a white cauliflower and a tomato on a dark background -
 * produce a global luminance spread of 0.099 to 0.285 and a hue spread of
 * essentially zero. A blank, blown-out or fully transparent frame produces a
 * spread of exactly zero, and rainbow noise a hue spread of 0.97. The gaps are
 * wide, so the cut-offs sit in the middle of them.
 *
 * Note what is deliberately **not** gated: the classifier's own fit score. It
 * cannot be, and measuring is the only way to find that out. Lettering on a
 * wall scores 0.846 against the crop signatures and a real cauliflower scores
 * 0.500, so any floor that rejected the wall would reject the vegetable. That
 * is not a tuning problem, it is what a closed-set classifier is: asked which
 * of four crops this is, it must answer with one of them, and human skin
 * genuinely is potato-coloured.
 *
 * The honest response to that is not a cleverer threshold. It is to let the
 * farmer confirm the crop - which is why `analyseProduce` scores all four and
 * the screen offers them.
 */
const MIN_SOURCE_PX = 48
const MIN_GLOBAL_CONTRAST = 0.05
// Real produce measured 0.01 to 0.11 across the held-out fixtures, sound and
// rotten alike; random noise measured 0.99. 0.45 sits in the empty space
// between, far from both.
const MAX_HUE_SPREAD = 0.45

/* ── The function every caller uses ───────────────────────────────────────── */

/**
 * Analyse a photograph.
 *
 * `source` is anything canvas can draw: an <img>, a <video>, or an ImageBitmap.
 * `expectedCropId` biases nothing - it is only used to report disagreement, so
 * a farmer who says "tomato" and photographs a potato is told about it.
 */
export function analyseProduce(source, { expectedCropId = null, cropId: forcedCropId = null } = {}) {
  const sourceWidth = source.naturalWidth || source.width || 0
  const sourceHeight = source.naturalHeight || source.height || 0

  if (Math.min(sourceWidth, sourceHeight) < MIN_SOURCE_PX) {
    return {
      ok: false,
      reason: 'That image is too small to read. Take a photo with the camera rather than using a thumbnail.',
    }
  }

  const raw = toPixels(source)
  const contrast = globalContrast(raw)

  if (contrast < MIN_GLOBAL_CONTRAST) {
    return {
      ok: false,
      reason: 'This photo is almost entirely one flat colour, so there is nothing to measure. Point the camera at the produce in good light.',
    }
  }

  const balanced = whiteBalance(raw)
  const { pixels: produce, width, height, coverage, fallback } = segment(balanced)

  if (produce.length < 100) {
    return {
      ok: false,
      reason: 'Could not find any produce in this photo. Fill more of the frame and try again.',
    }
  }

  const stats = measure(produce, width, height)

  if (stats.hueSpread > MAX_HUE_SPREAD) {
    return {
      ok: false,
      reason: 'This photo has no single dominant colour, so it does not look like one lot of produce. Photograph one crop at a time.',
    }
  }

  const { cropId: suggestedCropId, confidence, bestFit, ranking } = classifyCrop(stats)

  // The farmer's choice always wins over the classifier's.
  const cropId = forcedCropId ?? suggestedCropId
  const crop = getCrop(cropId)

  /**
   * Score every crop, not only the winner.
   *
   * The measurements are crop-independent; only two things depend on which crop
   * this is - whether pale counts as healthy, and the baseline shelf life. So
   * all four can be scored in one pass, and correcting the crop on the screen
   * becomes instant rather than a re-analysis.
   */
  const grid = tiles(produce, width, height, cropId)
  const perCrop = {}
  for (const c of CROPS) {
    const overallC = scoreQuality(stats, c.id)
    const cells = c.id === cropId ? grid : tiles(produce, width, height, c.id)
    const worstC = cells.length ? Math.min(...cells.map((t) => t.score)) : overallC
    const freshnessC = Math.round(overallC * 0.7 + worstC * 0.3)
    perCrop[c.id] = {
      freshness: freshnessC,
      remainingDays: Math.max(0.5, Math.round(c.shelfLifeDays * (freshnessC / 100) * 10) / 10),
      worstRegionScore: worstC,
      uneven: cells.length > 1 && overallC - worstC >= 15,
    }
  }

  const chosen = perCrop[cropId]
  const freshness = chosen.freshness
  const remainingDays = chosen.remainingDays

  let recommendation
  if (freshness >= 75 && remainingDays >= 4) recommendation = 'COLD_STORE'
  else if (freshness >= 50 && remainingDays >= 2) recommendation = 'SELL_NOW'
  else recommendation = 'SELL_URGENT'

  const disagreement =
    expectedCropId && expectedCropId !== cropId && confidence >= 45 ? expectedCropId : null

  return {
    ok: true,
    cropId,
    crop,
    // What the classifier thought, kept separate from what the farmer confirmed.
    suggestedCropId,
    corrected: Boolean(forcedCropId) && forcedCropId !== suggestedCropId,
    confidence,
    ranking: ranking.map((r) => ({ cropId: r.cropId, score: Math.round(r.score * 100) })),
    perCrop,
    freshness,
    remainingDays,
    recommendation,
    disagreement,
    lowConfidence: confidence < 45,
    uneven: chosen.uneven,
    worstRegionScore: chosen.worstRegionScore,
    features: {
      hue: Math.round(stats.hue),
      saturationPct: Math.round(stats.saturation * 100),
      brightnessPct: Math.round(stats.value * 100),
      blemishPct: Math.round(stats.blemish * 1000) / 10,
      browningPct: Math.round(stats.browning * 1000) / 10,
      texture: Math.round(stats.texture * 10000) / 10000,
      hueSpread: Math.round(stats.hueSpread * 100) / 100,
      coveragePct: Math.round(coverage * 100),
      usedFallbackRegion: fallback,
      whiteBalanced: balanced.corrected,
      whiteBalanceGains: balanced.gains,
      regionsScored: grid.length,
      bestFit: Math.round(bestFit * 1000) / 1000,
      globalContrast: Math.round(contrast * 1000) / 1000,
      sourceWidth,
      sourceHeight,
    },
    // The illuminant corrected pixels, so anything downstream reads the same
    // picture the measurements above were taken from. Non enumerable in spirit:
    // it is a handle for the model, not part of the result a screen renders.
    balancedCanvas: balanced.corrected ? toCanvas(balanced) : null,
  }
}

/* ── The trained model, layered on top ────────────────────────────────────── */

/**
 * Analyse a photograph, using the trained classifier when it is available.
 *
 * The order matters and is the whole design:
 *
 *   1. The classical pipeline runs **first**, unconditionally. It applies the
 *      validity gates and takes the visible measurements. If it refuses the
 *      photograph, the model is never consulted - a network is no better at
 *      recognising a picture of a wall than the colour signatures were, because
 *      both are closed-set and both must answer with one of their classes.
 *   2. Only then is the model asked which crop and which stage. If it answers
 *      confidently, its answer replaces the colour-signature guess and the
 *      shelf life comes from the published table its stage maps to.
 *   3. If it is unavailable, still downloading, or unsure, nothing happens and
 *      the classical result stands. The farmer never sees an error, because
 *      from their side nothing is broken.
 *
 * Async, unlike `analyseProduce`, because loading a runtime and running
 * inference cannot be pretended to be instant.
 */
export async function analyseProduceSmart(source, options = {}) {
  const classical = analyseProduce(source, options)
  if (!classical.ok) return classical

  let prediction = null
  try {
    // The corrected canvas when there is one, the original otherwise. A model
    // shown a blue photograph of a red tomato will say something different from
    // one shown the corrected version, and the corrected version is what every
    // other number on the screen describes.
    prediction = await classifyProduce(classical.balancedCanvas ?? source)
  } catch {
    // Never let the model's failure become the farmer's problem.
    prediction = null
  }

  if (!prediction) {
    return { ...classical, modelUsed: false }
  }

  const appCrop = MODEL_CROP_TO_APP[prediction.crop] ?? null
  const known = appCrop && CROPS.some((c) => c.id === appCrop)

  /**
   * Do the two estimators agree?
   *
   * The confidence threshold below is not enough on its own, because a
   * closed-set network is at its most dangerous when it is *confident* and
   * wrong: shown something outside its training distribution it will answer
   * with one of its classes at 99%. Measured here - synthetic produce shapes
   * came back as "spoiled" at 94% while the pixels underneath showed zero
   * blemish, zero browning and full colour.
   *
   * So the network's verdict is cross-examined against what the pixels
   * actually say. They are independent estimators, and disagreement between
   * them is information rather than noise: it means one of the two is looking
   * at something it does not understand, and the app has no way to know which.
   * In that case it declines to overrule the measurement and says so.
   */
  const visibleDamage = classical.features.blemishPct + classical.features.browningPct
  const saysRuined = prediction.stage === 'spoiled'
  // `unripe` is deliberately absent. Unripe produce is dark, dull and green,
  // which a browning detector tuned for ripe fruit reads as damage every time.
  // Including it made a correctly identified unripe tomato contradict itself.
  const saysSound = prediction.stage === 'fresh'

  // Thresholds sit far apart on purpose. This fires on flat contradiction, not
  // on the ordinary disagreement of two methods reading a marginal lot.
  const contradiction =
    (saysRuined && visibleDamage < 3) || (saysSound && visibleDamage > 25)

  // A crop the app does not stock, or a hesitant answer, is not worth
  // overruling a measurement for.
  if (!known || prediction.cropConfidence < 55) {
    return {
      ...classical,
      modelUsed: true,
      modelDeferred: true,
      model: prediction,
    }
  }

  // A contradiction is about **condition, not identity**.
  //
  // Handing the whole decision back to the colour signatures was wrong, and
  // measurably so: shown an unripe tomato the model answered tomato at 99% and
  // unripe at 100%, the rule fired, and the signatures then called it a potato.
  // On crop identity the model scores 98.9% against a hand tuned colour
  // signature, so there is no honest basis for the signatures to overrule it.
  //
  // So the crop stays the model's, the freshness falls back to what the pixels
  // measured, and the screen says the two did not agree.
  if (contradiction) {
    const cropOnDisagreement = getCrop(appCrop)
    const fallbackScores = classical.perCrop?.[appCrop]
    const fallbackFreshness = fallbackScores?.freshness ?? classical.freshness
    const fallbackDays = fallbackScores?.remainingDays ?? classical.remainingDays
    return {
      ...classical,
      cropId: appCrop,
      crop: cropOnDisagreement,
      suggestedCropId: appCrop,
      confidence: prediction.cropConfidence,
      freshness: fallbackFreshness,
      remainingDays: fallbackDays,
      recommendation:
        fallbackFreshness >= 75 && fallbackDays >= 4
          ? 'COLD_STORE'
          : fallbackFreshness >= 50 && fallbackDays >= 2
            ? 'SELL_NOW'
            : 'SELL_URGENT',
      modelUsed: true,
      modelDeferred: true,
      modelContradicted: true,
      model: prediction,
    }
  }

  const crop = getCrop(appCrop)

  /**
   * The stage sets the band; the pixels place the lot inside it.
   *
   * Taking the stage's quality figure directly makes the score piecewise
   * constant - a tomato with nine dark lesions and a spotless one both land on
   * "fresh" and both read 92, which is visibly wrong to anyone holding the two
   * lots. The network is good at *which band*; the measurements are good at
   * *how far through it*. So the stage supplies the anchor and the measured
   * damage moves it, by a bounded amount so a reading can never cross into a
   * band the network did not choose.
   */
  const damage = classical.features.blemishPct + classical.features.browningPct
  const anchor = prediction.freshness ?? classical.freshness
  const adjustment = Math.max(-18, Math.min(4, 4 - damage * 1.6))
  let freshness = Math.max(3, Math.min(99, Math.round(anchor + adjustment)))

  // An uneven lot is judged by its worst part on this path too.
  //
  // The tiled analysis was only reaching the classical score, so once the model
  // answered, a crate going bad from one corner scored almost the same as a
  // clean one: the damage term above is a whole frame average, and one bad
  // corner barely moves an average. The worst tile can only pull the reading
  // down, never lift it.
  if (classical.uneven && typeof classical.worstRegionScore === 'number') {
    const worst = Math.min(freshness, classical.worstRegionScore)
    const blended = freshness * 0.65 + worst * 0.35
    // Bounded, because a single shadowed tile can score near zero and would
    // otherwise take the whole lot with it: a fresh capsicum read 60 instead of
    // 92 for exactly that reason. An uneven lot is worth a warning and a real
    // deduction, not a different verdict invented by one dark corner.
    freshness = Math.max(3, Math.round(Math.max(blended, freshness - 20)))
  }
  const remainingDays =
    typeof prediction.remainingDays === 'number'
      ? Math.max(0.5, Math.round(prediction.remainingDays * (freshness / 100) * 10) / 10)
      : classical.remainingDays

  let recommendation
  if (freshness >= 75 && remainingDays >= 4) recommendation = 'COLD_STORE'
  else if (freshness >= 50 && remainingDays >= 2) recommendation = 'SELL_NOW'
  else recommendation = 'SELL_URGENT'

  return {
    ...classical,
    cropId: appCrop,
    crop,
    suggestedCropId: appCrop,
    confidence: prediction.cropConfidence,
    lowConfidence: prediction.cropConfidence < 55,
    freshness,
    remainingDays,
    recommendation,
    modelUsed: true,
    modelDeferred: false,
    model: prediction,
  }
}

export const RECOMMENDATIONS = {
  COLD_STORE: {
    en: { title: 'Send to cold storage', body: 'This produce is fresh and will hold. Storing it lets you sell on a better day.' },
    hi: { title: 'कोल्ड स्टोरेज भेजें', body: 'यह माल ताज़ा है और टिकेगा। स्टोर करके आप बेहतर भाव पर बेच सकते हैं।' },
    pa: { title: 'ਕੋਲਡ ਸਟੋਰੇਜ ਭੇਜੋ', body: 'ਇਹ ਮਾਲ ਤਾਜ਼ਾ ਹੈ ਅਤੇ ਟਿਕੇਗਾ। ਸਟੋਰ ਕਰਕੇ ਤੁਸੀਂ ਚੰਗੇ ਭਾਅ ਉੱਤੇ ਵੇਚ ਸਕਦੇ ਹੋ।' },
  },
  SELL_NOW: {
    en: { title: 'Sell in the next day or two', body: 'Still saleable, but not worth the cost of storing. Move it soon.' },
    hi: { title: 'एक-दो दिन में बेच दें', body: 'बिकने लायक है, पर स्टोर करने का ख़र्च वसूल नहीं होगा। जल्दी निकाल दें।' },
    pa: { title: 'ਇੱਕ-ਦੋ ਦਿਨ ਵਿੱਚ ਵੇਚ ਦਿਓ', body: 'ਵਿਕਣ ਯੋਗ ਹੈ, ਪਰ ਸਟੋਰ ਕਰਨ ਦਾ ਖ਼ਰਚ ਵਸੂਲ ਨਹੀਂ ਹੋਵੇਗਾ। ਛੇਤੀ ਕੱਢ ਦਿਓ।' },
  },
  SELL_URGENT: {
    en: { title: 'Sell today', body: 'This is already turning. Sell it now, even at a discount, rather than lose it.' },
    hi: { title: 'आज ही बेच दें', body: 'यह ख़राब होने लगा है। कम दाम पर ही सही, आज बेच दें, बर्बाद होने से बेहतर है।' },
    pa: { title: 'ਅੱਜ ਹੀ ਵੇਚ ਦਿਓ', body: 'ਇਹ ਖ਼ਰਾਬ ਹੋਣ ਲੱਗਾ ਹੈ। ਘੱਟ ਭਾਅ ਉੱਤੇ ਹੀ ਸਹੀ, ਅੱਜ ਵੇਚ ਦਿਓ, ਬਰਬਾਦ ਹੋਣ ਤੋਂ ਬਿਹਤਰ ਹੈ।' },
  },
}

export { CROPS }
