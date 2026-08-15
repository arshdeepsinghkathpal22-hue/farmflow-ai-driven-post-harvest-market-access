/**
 * Find a Chromium that will actually launch.
 *
 * Every script here used to carry its own list of guessed paths, with the
 * system Edge at the top. That worked until an Edge update left the machine
 * with a binary that exits immediately on launch and prints nothing, at which
 * point the whole suite reported "No Chromium found" and there was no way to
 * tell a broken browser from a missing one.
 *
 * So: prefer a browser downloaded for this project, because that one is a known
 * version and nothing else updates it underneath us. Fall back to whatever the
 * system has. And rather than trusting any path, **try to launch each candidate
 * and keep the first that survives** - an executable that exists is not the same
 * as an executable that runs.
 *
 *   npx @puppeteer/browsers install chrome@stable
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import puppeteer from 'puppeteer-core'

/** Chromium builds downloaded by @puppeteer/browsers, newest first. */
function downloaded() {
  const root = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome')
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root)
    .sort()
    .reverse()
    .flatMap((dir) => [
      path.join(root, dir, 'chrome-win64', 'chrome.exe'),
      path.join(root, dir, 'chrome-win', 'chrome.exe'),
      path.join(root, dir, 'chrome-linux64', 'chrome'),
      path.join(root, dir, 'chrome-mac-x64', 'Google Chrome for Testing.app',
        'Contents', 'MacOS', 'Google Chrome for Testing'),
    ])
    .filter((p) => fs.existsSync(p))
}

const SYSTEM = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  `${os.homedir()}/AppData/Local/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

export function candidates() {
  return [process.env.QA_BROWSER, ...downloaded(), ...SYSTEM].filter(Boolean)
}

/**
 * Launch the first candidate that works. Never returns a half-open browser.
 */
export async function launch(options = {}) {
  const tried = []
  for (const executablePath of candidates()) {
    if (executablePath !== process.env.QA_BROWSER && !fs.existsSync(executablePath)) continue
    try {
      return await puppeteer.launch({ executablePath, headless: 'new', ...options })
    } catch (error) {
      tried.push(`${executablePath}: ${String(error.message).split('\n')[0]}`)
    }
  }

  console.error('No Chromium could be launched. Tried:')
  for (const line of tried) console.error(`  ${line}`)
  console.error('\nInstall one for this project with:')
  console.error('  npx @puppeteer/browsers install chrome@stable')
  process.exit(1)
}
