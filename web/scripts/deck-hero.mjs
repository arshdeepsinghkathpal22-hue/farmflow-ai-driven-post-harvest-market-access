/**
 * Capture the freshness verdict for the SIH deck, cropped at a real boundary.
 *
 * The previous hero image was a hand-made pixel crop that sliced through the
 * middle of a word - the slide showed "days at room temperat…" - and nothing
 * regenerated it, so it also went stale the moment the numbers changed.
 *
 * This screenshots **elements**, not a rectangle: the verdict block and the two
 * metric tiles under it. Whatever the wording becomes, the crop still ends
 * where a block ends.
 *
 *   node scripts/deck-hero.mjs ../docs/deck-hero.png
 */

import fs from 'node:fs'
import path from 'node:path'
import { launch } from './browser.mjs'

const BASE = process.env.QA_BASE || 'http://localhost:4173'
const OUT = path.resolve(process.argv[2] || '../docs/deck-hero.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 430, height: 1400, deviceScaleFactor: 2 })

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
await page.evaluate(() => {
  window.location.hash = '#/freshness'
})
// The ONNX runtime is 13 MB; give it room to arrive and compile.
await sleep(9000)

const fed = await page.evaluate(async () => {
  const blob = await (await fetch('/fixtures/tomato-fresh.jpg')).blob()
  const dt = new DataTransfer()
  dt.items.add(new File([blob], 'tomato-fresh.jpg', { type: 'image/jpeg' }))
  const inputs = [...document.querySelectorAll('main input[type=file]')]
  const input = inputs[inputs.length - 1]
  if (!input) return false
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return true
})
if (!fed) {
  console.error('could not hand the photo to the analyser')
  process.exit(1)
}
await sleep(3500)

// Find the card holding the verdict, then take everything from the top of that
// card down to the bottom of the last metric tile inside it.
const box = await page.evaluate(() => {
  const main = document.querySelector('main')
  if (!main) return null
  // The smallest element that holds both readings **and** the photograph the
  // reading came from. Two earlier attempts got this wrong in opposite
  // directions: the first match walked out to the page container and dragged in
  // the screen heading, and the smallest match cropped the tomato away entirely
  // - which would have left the slide captioned "real photograph" above no
  // photograph.
  const candidates = [...main.querySelectorAll('div')]
    .filter(
      (d) =>
        /FRESHNESS/i.test(d.innerText) &&
        /SHELF LIFE/i.test(d.innerText) &&
        d.querySelector('img, canvas') &&
        d.clientHeight > 200,
    )
    .sort((a, b) => a.clientHeight - b.clientHeight)
  const card = candidates[0]
  if (!card) return null

  // The deepest elements that actually contain the two numbers. Ending at their
  // bottom guarantees the crop never lands inside a line of text.
  const tiles = [...card.querySelectorAll('div')].filter(
    (d) => /FRESHNESS|SHELF LIFE/i.test(d.innerText) && d.clientHeight < 200,
  )
  const last = tiles[tiles.length - 1] ?? card
  const top = card.getBoundingClientRect().top
  const bottom = last.getBoundingClientRect().bottom
  const r = card.getBoundingClientRect()
  return { x: r.x, y: top, width: r.width, height: bottom - top }
})

if (!box || box.height < 100) {
  console.error('could not locate the verdict card')
  process.exit(1)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
await page.screenshot({
  path: OUT,
  clip: { x: box.x, y: box.y, width: box.width, height: box.height + 12 },
})
await browser.close()

const kb = Math.round(fs.statSync(OUT).size / 1024)
console.log(`wrote ${OUT} (${kb} KB, ${Math.round(box.width)}x${Math.round(box.height + 12)} css px)`)
