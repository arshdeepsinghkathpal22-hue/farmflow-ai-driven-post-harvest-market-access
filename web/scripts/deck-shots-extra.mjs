/**
 * Two more compact crops, in the same style as deck-shots.mjs: home, voice,
 * verify and impact already have a crop that stops at a real block boundary;
 * storage and group do not, because the presentation deck that first asked
 * for crops never needed them. The SIH slide deck's "Feasibility" slide now
 * does, since its own bullets say "uses existing cold-storage infrastructure"
 * and "aggregates small farmer lots" and a screenshot for either point beats
 * an empty half-slide.
 *
 * Same method as the original: walk the screen's top level blocks, keep
 * whichever whole blocks fit under the aspect ratio, stop there.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './browser.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_BASE || 'http://localhost:4173'
const OUT = path.join(HERE, '..', '..', 'docs', 'deck')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SHOTS = [
  { name: 'storage.png', route: '#/storage', aspect: 1.7 },
  { name: 'group.png', route: '#/group', aspect: 1.7 },
]

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 430, height: 1600, deviceScaleFactor: 2 })

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' })
await sleep(500)
await page.evaluate(() => {
  ;[...document.querySelectorAll('[role="dialog"] button')]
    .find((b) => b.innerText.includes('Start the demo'))
    ?.click()
})
await sleep(400)

for (const { name, route, aspect } of SHOTS) {
  await page.goto(BASE + '/' + route, { waitUntil: 'networkidle0' })
  await sleep(500)

  // Descend through single-child wrappers to the real stack of cards, same
  // as the original script does, so this walks the app's actual blocks.
  const info = await page.evaluate(() => {
    let el = document.querySelector('main') || document.body
    while (el.children.length === 1) el = el.children[0]
    const top = el.getBoundingClientRect().top
    return {
      top,
      blocks: [...el.children].map((c) => {
        const r = c.getBoundingClientRect()
        return { bottom: r.bottom - top }
      }),
    }
  })

  const width = 430
  let cutHeight = 0
  for (const b of info.blocks) {
    const candidate = b.bottom
    if (candidate / width > aspect) break
    cutHeight = candidate
  }
  if (cutHeight === 0) cutHeight = info.blocks[0]?.bottom || width * aspect

  const clip = { x: 0, y: info.top, width, height: Math.ceil(cutHeight) }
  await page.screenshot({ path: path.join(OUT, name), clip })
  console.log(`  ${name}  ${clip.width}x${clip.height}  (${(clip.height / clip.width).toFixed(2)})`)
}

await browser.close()
