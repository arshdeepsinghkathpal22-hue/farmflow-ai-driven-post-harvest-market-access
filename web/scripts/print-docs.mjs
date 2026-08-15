/**
 * Render the submission HTML to PDF.
 *
 *   node scripts/print-docs.mjs <source-dir> <output-dir> [file.html ...]
 *
 * This replaces a pipeline that drove `msedge.exe --print-to-pdf` directly.
 * That worked until it did not: Edge's headless CLI now hangs on this machine
 * without ever exiting or writing anything. Puppeteer talks to the same browser
 * over the DevTools protocol instead of relying on the CLI's own lifecycle, and
 * it is already a dependency here - the QA suite drives Chrome or Edge through
 * it on every run, so it is the path in this repository with the most evidence
 * behind it.
 *
 * Footers are drawn by the browser rather than stamped into the file
 * afterwards, which removes the whole class of races the previous version had
 * to defend against: there is no second write to lose.
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from './browser.mjs'


// source -> [output name, footer label]. A null label means the document draws
// its own furniture, as the 16:9 deck does.
const JOBS = [
  ['00_start_here.html', '00_START_HERE.pdf', 'FarmFlow · Start Here'],
  ['01_deck.html', '01_Execution_Plan_Deck.pdf', null],
  ['02_team.html', '02_Team_Details_and_Profiles.pdf', 'FarmFlow · Team Details and Profiles'],
  ['03_demo.html', '03_Demonstration_Evidence.pdf', 'FarmFlow · Demonstration Evidence'],
  ['04_architecture.html', '04_Technical_Architecture.pdf', 'FarmFlow · Technical Architecture'],
  ['05_impact.html', '05_Impact_and_Business_Model.pdf', 'FarmFlow · Impact and Business Model'],
]

const [srcDir, outDir, ...only] = process.argv.slice(2)
if (!srcDir || !outDir) {
  console.error('usage: node scripts/print-docs.mjs <source-dir> <output-dir> [file.html ...]')
  process.exit(1)
}
fs.mkdirSync(outDir, { recursive: true })

const browser = await launch()

const footerTemplate = (label) => `
  <div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5pt;
              color:#8a968a;padding:0 45px;display:flex;justify-content:space-between;">
    <span>${label}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`

let failures = 0

for (const [srcName, pdfName, label] of JOBS) {
  if (only.length && !only.includes(srcName)) continue

  const src = path.resolve(srcDir, srcName)
  if (!fs.existsSync(src)) {
    console.log(`  SKIP ${srcName} (missing)`)
    continue
  }

  const dest = path.resolve(outDir, pdfName)
  // Remove the previous render first. Everything after this decides whether the
  // render worked by asking whether the file is there; left in place, last
  // week's PDF answers yes and a failure passes silently as a stale document.
  if (fs.existsSync(dest)) fs.rmSync(dest)

  const page = await browser.newPage()
  try {
    await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle0', timeout: 120000 })
    await page.emulateMediaType('print')
    await page.pdf({
      path: dest,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: Boolean(label),
      headerTemplate: '<div></div>',
      footerTemplate: label ? footerTemplate(label) : '<div></div>',
      margin: label ? { top: '0', bottom: '42px', left: '0', right: '0' } : undefined,
    })

    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      throw new Error('no PDF was written')
    }
    const kb = Math.round(fs.statSync(dest).size / 1024)
    console.log(`  ${pdfName}  (${kb} KB)`)
  } catch (error) {
    failures += 1
    console.log(`  FAILED ${pdfName}: ${error.message}`)
  } finally {
    await page.close()
  }
}

await browser.close()

if (failures) {
  console.error(`\n${failures} document(s) failed.`)
  process.exit(1)
}
console.log(`\nPDFs written to ${path.resolve(outDir)}`)
