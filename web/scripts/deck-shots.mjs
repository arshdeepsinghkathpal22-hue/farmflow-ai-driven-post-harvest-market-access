/**
 * Capture the screenshots the SIH deck uses, cut at block boundaries.
 *
 * The first version of this cropped the full page screenshots to a fixed
 * aspect ratio, which sliced wherever that landed: through the middle of a
 * sentence on one slide, through the middle of a card on another. On a slide
 * it reads as a mistake, because it is one.
 *
 * So nothing here crops by pixels. Each shot walks the top level blocks of the
 * screen, keeps adding them while the result still fits the shape a slide
 * wants, and stops at the bottom edge of the last whole block. Whatever the app
 * renders, the image ends where something ends.
 *
 *   node scripts/deck-shots.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './browser.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_BASE || 'http://localhost:4173'
const OUT = path.join(HERE, '..', '..', 'docs', 'deck')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * How tall each shot may get, as height divided by width.
 *
 * These are not round numbers picked for tidiness. Each screen's blocks were
 * measured and the limit set just past the block that carries the point, so
 * the crop reaches it and stops:
 *
 *   home    the market insight and the group booking offer end at 1.75
 *   voice   the microphone and the spoken Hindi phrase end at 1.27
 *   verify  the paste box and the check button end at 1.09
 *   impact  the food saved and income figures end at 1.80
 *
 * Set any of them lower and the shot stops before the thing worth showing.
 */
const SHOTS = [
  { name: 'home.png', route: '#/', aspect: 1.8 },
  { name: 'voice.png', route: '#/voice', aspect: 1.3, example: true },
  { name: 'verify.png', route: '#/verify', aspect: 1.1 },
  { name: 'impact.png', route: '#/impact', aspect: 1.85 },
  // The verdict, on a real photograph. This one had been produced by a second
  // script and then left behind when that script went, so the deck depended on
  // an image nothing could rebuild. It runs from here now, like the rest.
  { name: 'freshness.png', route: '#/freshness', photo: 'tomato-fresh.jpg' },
]

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 430, height: 1600, deviceScaleFactor: 2 })

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await page.addStyleTag({
  content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
})
await sleep(600)
await page.evaluate(() => {
  ;[...document.querySelectorAll('[role="dialog"] button')]
    .find((b) => b.innerText.includes('Start the demo'))
    ?.click()
})
await sleep(400)

fs.mkdirSync(OUT, { recursive: true })

/**
 * Height of the tallest run of whole blocks that still fits the wanted shape.
 * Returns null when the very first block is already too tall, which is a real
 * answer rather than a reason to cut it in half.
 */
const blockBottom = (aspect) =>
  page.evaluate((wanted) => {
    let container = document.querySelector('main')
    if (!container) return null

    // Every screen wraps its cards in a single layout div, so main itself has
    // one child and walking main's children finds exactly one enormous block.
    // Descend until the container actually holds a list of things.
    while (container.children.length === 1 && container.children[0].children.length > 0) {
      container = container.children[0]
    }

    const width = document.documentElement.clientWidth
    const limit = width * wanted
    let bottom = 0
    for (const block of container.children) {
      const rect = block.getBoundingClientRect()
      if (rect.height < 8) continue
      if (rect.bottom > limit) break
      bottom = rect.bottom
    }
    return bottom > 0 ? Math.round(bottom) : null
  }, aspect)

for (const shot of SHOTS) {
  await page.evaluate((r) => {
    window.location.hash = r
  }, shot.route)
  await sleep(900)

  if (shot.example) {
    await page.evaluate(() => {
      ;[...document.querySelectorAll('button, a')]
        .find((b) => /Try an example instead/i.test(b.innerText))
        ?.click()
    })
    await sleep(1100)
  }

  let clip
  if (shot.photo) {
    // The runtime is 13 MB, so give it room to arrive before handing it a file.
    await sleep(8500)
    const fed = await page.evaluate(async (name) => {
      const blob = await (await fetch(`/fixtures/${name}`)).blob()
      const dt = new DataTransfer()
      dt.items.add(new File([blob], name, { type: 'image/jpeg' }))
      const inputs = [...document.querySelectorAll('main input[type=file]')]
      const input = inputs[inputs.length - 1]
      if (!input) return false
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }, shot.photo)
    if (!fed) {
      console.error(`  ${shot.name}: could not hand the photo over, skipped`)
      continue
    }
    await sleep(3500)
    clip = await page.evaluate(() => {
      const main = document.querySelector('main')
      const card = [...main.querySelectorAll('div')]
        .filter(
          (d) =>
            /FRESHNESS/i.test(d.innerText) &&
            /SHELF LIFE/i.test(d.innerText) &&
            d.querySelector('img, canvas') &&
            d.clientHeight > 200,
        )
        .sort((a, b) => a.clientHeight - b.clientHeight)[0]
      if (!card) return null

      // Stop at the bottom of the two readings rather than taking the whole
      // card. Everything below them is the crop confirmation, which is worth
      // having on the phone and makes the picture too tall for a slide.
      const tiles = [...card.querySelectorAll('div')].filter(
        (d) => /FRESHNESS|SHELF LIFE/i.test(d.innerText) && d.clientHeight < 220,
      )
      const last = tiles[tiles.length - 1]
      const r = card.getBoundingClientRect()
      const bottom = last ? last.getBoundingClientRect().bottom : r.bottom
      return { x: r.x, y: r.y, width: r.width, height: bottom - r.y + 14 }
    })
    if (!clip) {
      console.error(`  ${shot.name}: verdict card not found, skipped`)
      continue
    }
  } else {
    const bottom = await blockBottom(shot.aspect)
    if (!bottom) {
      console.error(`  ${shot.name}: no whole block fits ${shot.aspect}, skipped`)
      continue
    }
    const width = await page.evaluate(() => document.documentElement.clientWidth)
    clip = { x: 0, y: 0, width, height: bottom + 14 }
  }

  const file = path.join(OUT, shot.name)
  await page.screenshot({ path: file, clip })
  const kb = Math.round(fs.statSync(file).size / 1024)
  console.log(
    `  ${shot.name.padEnd(15)} ${Math.round(clip.width)}x${Math.round(clip.height)}  ` +
      `aspect ${(clip.height / clip.width).toFixed(2)}  ${kb} KB`,
  )
}

await browser.close()
