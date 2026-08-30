/**
 * The trained produce classifier, running in the browser.
 *
 * A MobileNetV3-small with two heads - crop and stage - exported to ONNX and
 * executed by onnxruntime-web. The photograph never leaves the device, which is
 * the whole reason for doing it here rather than on a server.
 *
 * ─── How this relates to the classical pipeline ──────────────────────────────
 *
 * It does not replace it. `vision.js` still runs first and still does two jobs
 * the network cannot:
 *
 *   1. **The validity gates.** A trained classifier is no better at rejecting a
 *      photograph of a wall than the old colour signatures were - both are
 *      closed-set, both must answer with one of their classes. The gates on
 *      global contrast, hue coherence and image size are what refuse junk, and
 *      they run before the model is consulted.
 *   2. **The visible measurements.** Blemish coverage, browning and texture are
 *      what let the screen show its working. A softmax cannot explain itself.
 *
 * So the model refines the *answer* - which crop, which stage - while the
 * classical pipeline keeps deciding whether there is an answer to give at all.
 *
 * ─── Why it is loaded lazily ─────────────────────────────────────────────────
 *
 * The weights are 4.4 MB and the ONNX runtime another 13 MB, which on 2G is
 * minutes. So nothing here is fetched until the farmer actually opens the
 * freshness screen, the whole module is dynamically imported, and every failure
 * path leaves the app working exactly as it did before. A farmer who never
 * takes a photograph never pays for any of it.
 */

const BASE = import.meta.env?.BASE_URL ?? '/'

let loading = null
let state = { ready: false, failed: false, reason: null }

/** What the app can tell the farmer about the model, without loading it. */
export function modelStatus() {
  return { ...state }
}

/**
 * Load the runtime and the weights, once.
 *
 * Returns null rather than throwing on any failure - a missing model file, a
 * browser without WebAssembly, a corrupted download. The caller carries on with
 * the classical pipeline and the farmer sees no error, because from their point
 * of view nothing is wrong: the app still works.
 */
async function load() {
  if (loading) return loading

  loading = (async () => {
    try {
      const [ort, metaResponse] = await Promise.all([
        // The wasm-only entry point. Importing the default one drags in the
        // WebGPU build as well - a 25 MB file this app never executes.
        import('onnxruntime-web/wasm'),
        fetch(`${BASE}model/produce.json`),
      ])
      if (!metaResponse.ok) throw new Error(`metadata ${metaResponse.status}`)
      const meta = await metaResponse.json()

      // The .wasm path is deliberately *not* overridden. Left alone, the
      // runtime resolves it through the bundler, which emits exactly one copy
      // and rewrites the URL for whatever base path the site is deployed under
      // - including a project subpath on GitHub Pages. Setting it by hand meant
      // shipping the same 13 MB file twice.
      ort.env.wasm.numThreads = 1
      ort.env.logLevel = 'error'

      const session = await ort.InferenceSession.create(`${BASE}model/produce.onnx`, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })

      state = { ready: true, failed: false, reason: null, meta }
      return { session, meta, ort }
    } catch (error) {
      state = { ready: false, failed: true, reason: error?.message ?? 'could not load' }
      return null
    }
  })()

  return loading
}

/** Warm the model up in the background. Safe to call more than once. */
export function preloadModel() {
  load()
}

/**
 * Draw the image to the size the network was trained at and normalise it
 * exactly as training did.
 *
 * "Exactly" is the operative word. The mean and standard deviation live in the
 * exported metadata rather than being written out here, because a copy of them
 * that drifts from the training script produces predictions that are wrong
 * without ever looking wrong.
 */
function toTensor(source, meta, ort) {
  const size = meta.inputSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // Reproduce the evaluation transform exactly: resize the short side to
  // 1.14x the input, then centre-crop.
  //
  // A plain square crop is close but not the same, and "close" showed up as a
  // stage probability of 79% here against 57% in PyTorch on the identical
  // file. The verdict happened to agree; relying on that is how a pipeline
  // drifts away from the numbers it was validated against.
  const w = source.naturalWidth || source.width
  const h = source.naturalHeight || source.height
  const resized = Math.round(size * 1.14)
  const scale = resized / Math.min(w, h)
  const sw = w * scale
  const sh = h * scale
  ctx.drawImage(source, (sw - size) / -2, (sh - size) / -2, sw, sh)

  const { data } = ctx.getImageData(0, 0, size, size)
  const out = new Float32Array(3 * size * size)
  const [mr, mg, mb] = meta.mean
  const [sr, sg, sb] = meta.std
  const plane = size * size

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    out[p] = (data[i] / 255 - mr) / sr
    out[plane + p] = (data[i + 1] / 255 - mg) / sg
    out[2 * plane + p] = (data[i + 2] / 255 - mb) / sb
  }

  return new ort.Tensor('float32', out, [1, 3, size, size])
}

function softmax(values) {
  const max = Math.max(...values)
  const exps = values.map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

/**
 * Classify a photograph.
 *
 * Returns null whenever the model is unavailable or unsure enough that the
 * classical reading is the better answer. Null is not a failure here - it is
 * the model declining to overrule something that already works.
 */
export async function classifyProduce(source) {
  const loaded = await load()
  if (!loaded) return null

  const { session, meta, ort } = loaded

  try {
    const tensor = toTensor(source, meta, ort)
    const outputs = await session.run({ image: tensor })

    const cropProbs = softmax(Array.from(outputs.crop_logits.data))
    const stageProbs = softmax(Array.from(outputs.stage_logits.data))

    const cropIndex = cropProbs.indexOf(Math.max(...cropProbs))
    const stageIndex = stageProbs.indexOf(Math.max(...stageProbs))

    const crop = meta.crops[cropIndex]
    const stage = meta.stages[stageIndex]

    const shelf = meta.shelfLifeDays?.[crop]?.[stage]
    const quality = meta.stageQuality?.[stage]

    // The expectation over stages, not the winner's constant. Two fresh
    // tomatoes rarely get the same softmax, so this number - unlike
    // quality[argmax] - is different for every photograph, while still being
    // entirely the model's own opinion.
    const expectedQuality = meta.stages.reduce(
      (sum, s, i) => sum + stageProbs[i] * (meta.stageQuality?.[s] ?? 50),
      0,
    )
    const expectedShelf = meta.stages.reduce(
      (sum, s, i) => sum + stageProbs[i] * (meta.shelfLifeDays?.[crop]?.[s] ?? 0),
      0,
    )

    return {
      crop,
      stage,
      cropConfidence: Math.round(cropProbs[cropIndex] * 100),
      stageConfidence: Math.round(stageProbs[stageIndex] * 100),
      // The stage places the lot on a published shelf-life table; the model
      // does not measure days and this is not presented as if it did.
      remainingDays: typeof shelf === 'number' ? shelf : null,
      freshness: typeof quality === 'number' ? quality : null,
      expectedFreshness: Math.round(expectedQuality * 10) / 10,
      expectedRemainingDays: Math.round(expectedShelf * 10) / 10,
      cropProbabilities: Object.fromEntries(meta.crops.map((c, i) => [c, Math.round(cropProbs[i] * 100)])),
      stageProbabilities: Object.fromEntries(meta.stages.map((s, i) => [s, Math.round(stageProbs[i] * 100)])),
      accuracy: meta.testAccuracy,
    }
  } catch (error) {
    state = { ...state, failed: true, reason: error?.message ?? 'inference failed' }
    return null
  }
}

/** The app's crop ids differ from the training labels; this is the bridge. */
export const MODEL_CROP_TO_APP = {
  tomato: 'tomato',
  bell_pepper: 'capsicum',
}
