/**
 * Capture the screenshots used in the submission documents.
 *
 *   npm run build && npm run preview
 *   node scripts/shots.mjs <output-dir>        (in a second terminal)
 *
 * Animations are switched **off** rather than paused. Pausing them freezes any
 * entrance animation using `fill: both` at its first keyframe - which is
 * opacity zero - and every card in the app comes in that way, so a paused page
 * photographs as a blank screen. Turning them off leaves elements at their
 * final computed style, which is what we actually want a picture of.
 */

import fs from 'node:fs'
import path from 'node:path'
import { launch } from './browser.mjs'

const BASE = process.env.QA_BASE || 'http://localhost:4173'

const outDir = path.resolve(process.argv[2] || 'docs/screenshots')
fs.mkdirSync(outDir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launch()

const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 })

const STILL = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }`

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.addStyleTag({ content: STILL })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await page.addStyleTag({ content: STILL })
await sleep(900)

let n = 0
let viewport = { width: 430, height: 932 }

/**
 * Capture the screen.
 *
 * Long pages are photographed by growing the viewport to the full document
 * height rather than by using puppeteer's `fullPage`. They are not the same
 * thing: `fullPage` stitches a tall image while the page still believes it is
 * 932 pixels high, so the fixed bottom navigation stays pinned where the
 * viewport was and lands in the middle of the picture, on top of the content.
 * Growing the viewport instead means the layout is genuinely that tall and
 * everything anchored to the bottom is at the bottom.
 */
const shot = async (name, { full = false } = {}) => {
  await page.addStyleTag({ content: STILL })
  await sleep(350)

  if (full) {
    const height = await page.evaluate(() =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    )
    await page.setViewport({ ...viewport, height: Math.min(height, 8000), deviceScaleFactor: 2 })
    await sleep(500)
    await page.addStyleTag({ content: STILL })
    await sleep(250)
  }

  const file = path.join(outDir, `${String(n).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: file })
  console.log(`  ${path.basename(file)}`)
  n += 1

  if (full) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 2 })
    await sleep(250)
  }
}

const go = async (hash, wait = 800) => {
  await page.evaluate((h) => {
    window.location.hash = h
  }, hash)
  await sleep(wait)
}

const clickText = async (needle, wait = 700) => {
  const hit = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.includes(t))
    if (!el) return false
    el.click()
    return true
  }, needle)
  await sleep(wait)
  return hit
}

const setLanguage = async (native) => {
  await go('#/guide')
  await page.evaluate((t) => {
    ;[...document.querySelectorAll('main button')].find((b) => b.innerText.includes(t))?.click()
  }, native)
  await sleep(500)
}

/* ── the first-run guide ─────────────────────────────────────────────────── */

await shot('demo-guide')
await page.evaluate(() => {
  ;[...document.querySelectorAll('[role="dialog"] button')]
    .find((b) => b.innerText.includes('Start the demo'))
    ?.click()
})
await sleep(600)

/* ── the farmer's app ────────────────────────────────────────────────────── */

await go('#/')
await shot('farmer-home', { full: true })

await go('#/login')
await sleep(2600) // let the backend probe settle so the banner is not mid-check
await shot('sign-in')

await go('#/voice')
await clickText('Try an example instead', 1100)
await shot('voice-booking', { full: true })

await clickText('Confirm Booking', 1400)
await shot('digital-receipt', { full: true })

/* ── the photograph that ends in rupees ──────────────────────────────────── */

await setLanguage('English')
await go('#/freshness')
await page.evaluate(async () => {
  // A real held out photograph, not a synthetic blob. The screenshots go into
  // the submission documents, and a painted circle looks exactly like what it
  // is: a placeholder standing in for a product that was never run.
  const blob = await (await fetch('/fixtures/tomato-fresh.jpg')).blob()
  const dt = new DataTransfer()
  dt.items.add(new File([blob], 'tomato.jpg', { type: 'image/jpeg' }))
  const inputs = [...document.querySelectorAll('main input[type=file]')]
  const input = inputs[inputs.length - 1]
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
})
await sleep(3200)
await shot('freshness-check', { full: true })

/* ── advice, matching, pooling, market ───────────────────────────────────── */

await go('#/advisor')
await clickText('Tomato', 600)
await shot('price-advisor-store', { full: true })
await clickText('Cauliflower', 600)
await shot('price-advisor-sell', { full: true })

await go('#/storage')
await shot('storage-matching', { full: true })

await go('#/group')
await shot('group-booking', { full: true })

await go('#/marketplace')
await shot('buyer-marketplace', { full: true })

await go('#/bookings')
await shot('my-bookings', { full: true })

await go('#/impact')
await shot('impact-dashboard', { full: true })

/* ── the guide, in Punjabi ───────────────────────────────────────────────── */

await setLanguage('ਪੰਜਾਬੀ')
await shot('guide-punjabi', { full: true })
await setLanguage('English')

/* ── receipt verification ────────────────────────────────────────────────── */

await go('#/bookings')
const code = await page.evaluate(() => {
  const link = [...document.querySelectorAll('main a')].find((a) => /receipt/.test(a.getAttribute('href') || ''))
  return link?.getAttribute('href') ?? null
})
if (code) {
  await go(code.replace('#', ''))
  const qr = await page.evaluate(() => {
    const img = document.querySelector('main img[alt^="QR code"]')
    return img ? img.getAttribute('data-code') || null : null
  })
  void qr
}

await go('#/verify')
await page.evaluate(() => {
  const box = document.querySelector('#cc-code')
  if (!box) return
  const proto = Object.getPrototypeOf(box)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(box, box.placeholder)
  box.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(300)
await shot('receipt-verify-screen', { full: true })

/* ── offline ─────────────────────────────────────────────────────────────── */

await go('#/profile')
await page.evaluate(() => {
  document.querySelector('button[role="switch"]')?.click()
})
await sleep(600)
await go('#/voice')
await clickText('Try an example instead', 1100)
await clickText('Confirm Booking', 1200)
await go('#/bookings')
await shot('offline-booking', { full: true })
await go('#/profile')
await page.evaluate(() => {
  document.querySelector('button[role="switch"]')?.click()
})
await sleep(1800)

/* ── the owner's console ─────────────────────────────────────────────────── */

viewport = { width: 1280, height: 900 }
await page.setViewport({ ...viewport, deviceScaleFactor: 2 })
await go('#/owner', 1000)
await page.addStyleTag({ content: STILL })
await shot('owner-occupancy', { full: true })

for (const [label, name] of [
  ['Inventory', 'owner-inventory'],
  ['Payments', 'owner-payments'],
  ['Analytics', 'owner-analytics'],
  ['Staff', 'owner-staff'],
  ['Settings', 'owner-settings'],
]) {
  await clickText(label, 800)
  await shot(name, { full: true })
}

await browser.close()
console.log(`\n${n} screenshots written to ${outDir}`)
