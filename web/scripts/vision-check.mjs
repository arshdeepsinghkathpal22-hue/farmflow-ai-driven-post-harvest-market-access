/**
 * Run the real freshness pipeline over the held-out fixtures, in Node.
 *
 * This exists because driving a headless Chromium stopped being dependable on
 * this machine, and a check that cannot be run is not a check. Nothing here is
 * a reimplementation: `src/lib/vision.js` is loaded through Vite's SSR loader,
 * so it is the same module the app ships, with `import.meta.env` and the rest
 * resolved the way the bundler resolves them.
 *
 * Two things the browser provided have to be supplied instead:
 *
 *   · **A canvas.** Shimmed below. `scripts/fixtures-prepare.py` has already
 *     decoded and resized each photograph to the exact working size vision.js
 *     asks for, so the shim only ever copies pixels. It never resamples, which
 *     is the one place a hand written canvas could quietly disagree with a real
 *     one and make these numbers meaningless.
 *
 *   · **The model.** `./model.js` is aliased to a stub returning predictions
 *     computed by the same ONNX graph in Python. The model is verified on its
 *     own by its test set; what is under test here is how vision.js reconciles
 *     the model's answer with the pixel measurements.
 *
 *     node scripts/vision-check.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(HERE, '.fixtures')

if (!fs.existsSync(path.join(DATA, 'manifest.json'))) {
  console.error('No prepared fixtures. Run first:\n  python scripts/fixtures-prepare.py')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'))
const predictions = JSON.parse(fs.readFileSync(path.join(DATA, 'predictions.json'), 'utf8'))

/* ── The canvas shim ──────────────────────────────────────────────────────── */

class Ctx {
  constructor(canvas) {
    this.canvas = canvas
  }

  drawImage(source, _x, _y, w, h) {
    if (w !== source.width || h !== source.height) {
      // Deliberately fatal. Silently resampling here would be the one way this
      // harness could report numbers the browser would never produce.
      throw new Error(
        `shim asked to rescale ${source.width}x${source.height} to ${w}x${h}; ` +
          'prepare the fixture at the size vision.js works at instead',
      )
    }
    this.canvas._data = Uint8ClampedArray.from(source.data)
  }

  getImageData(_x, _y, w, h) {
    return { data: this.canvas._data ?? new Uint8ClampedArray(w * h * 4), width: w, height: h }
  }

  createImageData(w, h) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
  }

  putImageData(img) {
    this.canvas._data = Uint8ClampedArray.from(img.data)
  }
}

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`shim has no <${tag}>`)
    const canvas = { width: 0, height: 0, _data: null }
    canvas.getContext = () => new Ctx(canvas)
    return canvas
  },
}

/* ── Which fixture the model stub should answer for ───────────────────────── */

globalThis.__fixture = null

const stub = path.join(DATA, 'model-stub.mjs')
fs.writeFileSync(
  stub,
  `export async function classifyProduce() {
  const all = ${JSON.stringify(predictions)}
  return all[globalThis.__fixture] ?? null
}
export function preloadModel() {}
export function modelState() {
  return { ready: true, failed: false, reason: null, meta: null }
}
export const MODEL_CROP_TO_APP = { tomato: 'tomato', bell_pepper: 'capsicum' }
`,
)

const server = await createServer({
  root: path.join(HERE, '..'),
  logLevel: 'error',
  server: { middlewareMode: true },
  plugins: [
    {
      name: 'stub-the-model',
      enforce: 'pre',
      resolveId(id, importer) {
        if (id.endsWith('model.js') && importer?.includes('vision.js')) return stub
        return null
      },
    },
  ],
})

const vision = await server.ssrLoadModule('/src/lib/vision.js')

/* ── Run ──────────────────────────────────────────────────────────────────── */

function fixture(name) {
  const { width, height, bin } = manifest[name]
  const buf = fs.readFileSync(path.join(DATA, bin))
  return { width, height, data: new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.length) }
}

const EXPECTED = {
  'tomato-fresh.jpg': { crop: 'tomato', stage: 'fresh', min: 80 },
  'tomato-unripe.jpg': { crop: 'tomato', stage: 'unripe', min: 55 },
  'tomato-ageing.jpg': { crop: 'tomato', stage: null, min: 45 },
  'tomato-spoiled.jpg': { crop: 'tomato', stage: 'spoiled', max: 35 },
  'capsicum-fresh.jpg': { crop: 'capsicum', stage: 'fresh', min: 70 },
  'capsicum-spoiled.jpg': { crop: null, stage: 'spoiled', max: 35 },
  // Real photographs from the field test, not curated training-alikes.
  'user-tomato-vine.jpg': { crop: 'tomato', stage: 'fresh', min: 75 },
  'user-tomato-pile1.jpg': { crop: 'tomato', stage: 'fresh', min: 72 },
  'user-tomato-pile2.jpg': { crop: 'tomato', stage: 'fresh', min: 72 },
  'user-tomato-rotten.jpg': { crop: 'tomato', stage: 'spoiled', max: 30 },
}

let failures = 0
const rows = []

for (const name of Object.keys(manifest)) {
  globalThis.__fixture = name
  const source = fixture(name)

  let result
  try {
    result = await vision.analyseProduceSmart(source)
  } catch (error) {
    rows.push(`${name.padEnd(22)} THREW: ${error.message}`)
    failures += 1
    continue
  }

  if (!result || result.ok === false) {
    rows.push(`${name.padEnd(22)} REFUSED: ${result?.reason ?? 'no result'}`)
    failures += 1
    continue
  }

  const via = result.modelContradicted
    ? 'disagreed'
    : result.modelDeferred
      ? 'classical'
      : result.modelUsed
        ? 'model'
        : 'classical'

  const want = EXPECTED[name] ?? {}
  const problems = []
  if (want.crop && result.cropId !== want.crop) problems.push(`crop=${result.cropId} want ${want.crop}`)
  if (want.stage && result.model?.stage !== want.stage) problems.push(`stage=${result.model?.stage}`)
  if (want.min != null && result.freshness < want.min) problems.push(`fresh ${result.freshness} < ${want.min}`)
  if (want.max != null && result.freshness > want.max) problems.push(`fresh ${result.freshness} > ${want.max}`)
  if (problems.length) failures += 1

  rows.push(
    `${name.replace('.jpg', '').padEnd(20)}` +
      `crop=${String(result.cropId).padEnd(10)}` +
      `stage=${String(result.model?.stage ?? '-').padEnd(8)}` +
      `fresh=${String(result.freshness).padStart(3)}  ` +
      `days=${String(result.remainingDays).padStart(5)}  ` +
      `${via.padEnd(10)}` +
      (problems.length ? `  <-- ${problems.join(', ')}` : ''),
  )
}

console.log(rows.join('\n'))
await server.close()

if (failures) {
  console.log(`\n${failures} fixture(s) wrong`)
  process.exit(1)
}
console.log(`\nall ${Object.keys(manifest).length} fixtures within expectations`)
