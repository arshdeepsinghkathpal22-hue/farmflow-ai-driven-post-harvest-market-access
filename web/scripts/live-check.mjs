/**
 * Check the deployed site, not a local build.
 *
 *   node scripts/live-check.mjs [url] [screenshot.png]
 *
 * A local `npm run preview` proves the bundle works; it does not prove that
 * what GitHub Pages is actually serving works. Those differ in the ways that
 * bite hardest before a submission: an asset path that resolves under `/` but
 * not under `/Farm-Flow/`, a router that loses a deep link, a stale cached
 * index. So this drives the public URL.
 *
 * It does not look for particular words. An earlier version did, and every
 * failure it reported was the phrase being wrong rather than the screen being
 * broken, which is worse than useless before a deadline. Instead each route
 * has to mount something substantial and something *different from home*.
 * That catches the failure that actually matters here: a route falling through
 * the catch-all and quietly redirecting, which looks fine in a screenshot.
 *
 * The route list is read from App.jsx rather than typed out, so it cannot
 * drift away from the app.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './browser.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv[2] || 'https://itsharshcoder.github.io/Farm-Flow/').replace(/\/?$/, '/')
const SHOT = process.argv[3] || path.join(HERE, '..', 'live-home.png')

const app = fs.readFileSync(path.join(HERE, '..', 'src', 'App.jsx'), 'utf8')
const routes = [...app.matchAll(/<Route\s+path="([^"*]+)"/g)]
  .map((m) => m[1].replace(/^\//, ''))
  .filter((r) => !r.includes(':'))   // receipt/:id needs an id that exists

console.log(`checking ${BASE}`)
console.log(`${routes.length} routes read from App.jsx\n`)

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 })

const consoleErrors = []
const badRequests = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('requestfailed', (r) => badRequests.push(`${r.failure()?.errorText} ${r.url()}`))
page.on('response', (r) => r.status() >= 400 && badRequests.push(`HTTP ${r.status()} ${r.url()}`))

async function visit(hash) {
  await page.goto(BASE + hash, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 700))   // the hash router swaps without a reload
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
}

const home = await visit('')
console.log(`   ok   #/            home mounted, ${home.length} chars`)

let failures = 0
for (const route of routes) {
  const text = await visit('#/' + route)
  const thin = text.length < 150
  const sameAsHome = text === home
  const ok = !thin && !sameAsHome
  if (!ok) failures += 1
  const why = thin ? `only ${text.length} chars` : sameAsHome ? 'fell through to home' : `${text.length} chars`
  console.log(`  ${ok ? ' ok ' : 'FAIL'}  #/${route.padEnd(12)} ${why}`)
}

// A route the app does not know must land on home rather than a blank page.
const stray = await visit('#/no-such-screen')
const strayOk = stray === home
if (!strayOk) failures += 1
console.log(`  ${strayOk ? ' ok ' : 'FAIL'}  unknown route redirects to home`)

await visit('')
await page.screenshot({ path: SHOT })

console.log(`\n  console errors : ${consoleErrors.length}`)
consoleErrors.slice(0, 6).forEach((e) => console.log(`      ${e.slice(0, 150)}`))
console.log(`  failed requests: ${badRequests.length}`)
badRequests.slice(0, 6).forEach((e) => console.log(`      ${e.slice(0, 150)}`))

await browser.close()
const clean = !failures && !consoleErrors.length && !badRequests.length
console.log(clean ? '\nthe deployed site is sound' : `\n${failures} route problem(s)`)
process.exit(clean ? 0 : 1)
