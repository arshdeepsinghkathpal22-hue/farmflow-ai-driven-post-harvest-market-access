/**
 * Tests for the store-or-sell decision engine.
 *
 * Run with `npm run test:decision`.
 *
 * These assertions are about behaviour a farmer would recognise as sane, not
 * about exact rupee figures - the figures move whenever the price seed or the
 * decay constant is retuned, and a test that pins them would break on every
 * honest improvement. What must never change is the direction of the answer:
 * a falling market is never a reason to store, and a lot that cannot survive
 * storage is never sent to storage however good the price looks.
 */

import { decideForLot, decisionHeadline } from '../src/lib/decision.js'

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`)
  }
}

console.log('\nA rising market on fresh produce is worth waiting for')
{
  const d = decideForLot({ cropId: 'onion', remainingDays: 20, quantityKg: 450 })
  check('onion says store', d.action === 'STORE', `-> hold ${d.holdDays}d, +Rs ${d.gain}`)
  check('the gain is positive', d.gain > 0)
  check('the best day is not today', d.holdDays > 0)
  check('storage cost is subtracted', d.options[d.holdDays].storageCost > 0)
  check(
    'net is revenue minus storage',
    d.options[d.holdDays].net ===
      d.options[d.holdDays].revenue - d.options[d.holdDays].storageCost,
  )
}

console.log('\nA falling market is never a reason to store')
{
  const d = decideForLot({ cropId: 'cauliflower', remainingDays: 6, quantityKg: 450 })
  check('cauliflower says sell today', d.action === 'SELL_TODAY', `-> ${d.reason}`)
  check('no gain is claimed', d.gain === 0)
  check('hold days is zero', d.holdDays === 0)
}

console.log('\nA lot that cannot survive storage is not sent to storage')
{
  const fresh = decideForLot({ cropId: 'tomato', remainingDays: 8, quantityKg: 450 })
  const spoiling = decideForLot({ cropId: 'tomato', remainingDays: 1, quantityKg: 450 })
  check('a fresh tomato lot can be stored', fresh.action === 'STORE', `-> hold ${fresh.holdDays}d`)
  check('a spoiling tomato lot cannot', spoiling.action === 'SELL_TODAY', `-> ${spoiling.reason}`)
  check('and the reason names the shelf life', spoiling.reason.includes('not survive'))
}

console.log('\nThe photograph changes the answer, which is the whole point')
{
  const fresh = decideForLot({ cropId: 'tomato', remainingDays: 8, quantityKg: 450 })
  const tired = decideForLot({ cropId: 'tomato', remainingDays: 3, quantityKg: 450 })
  check(
    'same crop and same prices, different verdict',
    fresh.gain > tired.gain,
    `fresh +Rs ${fresh.gain} vs tired +Rs ${tired.gain}`,
  )
}

console.log('\nArithmetic holds up')
{
  const d = decideForLot({ cropId: 'onion', remainingDays: 20, quantityKg: 100, ratePaisePerKgDay: 6 })
  const day3 = d.options[3]
  check('storage cost is rate x weight x days', day3.storageCost === Math.round(0.06 * 100 * 3))
  check('sellable share never exceeds 100%', d.options.every((o) => o.sellablePct <= 100))
  check('sellable share only falls', d.options.every((o, i, a) => i === 0 || o.sellablePct <= a[i - 1].sellablePct))
  check('day zero has no storage cost', d.options[0].storageCost === 0)
  check('a bigger lot scales the gain', decideForLot({ cropId: 'onion', remainingDays: 20, quantityKg: 200 }).gain >
    decideForLot({ cropId: 'onion', remainingDays: 20, quantityKg: 100 }).gain)
}

console.log('\nThe verdict is readable in all three languages')
{
  const d = decideForLot({ cropId: 'onion', remainingDays: 20, quantityKg: 450 })
  for (const lang of ['en', 'hi', 'pa']) {
    const line = decisionHeadline(d, lang)
    check(`${lang} headline is produced`, typeof line === 'string' && line.length > 10, `"${line}"`)
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
