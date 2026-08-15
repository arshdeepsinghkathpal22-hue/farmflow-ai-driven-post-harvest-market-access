/**
 * Tests for the speech parser.
 *
 * Run with `npm run test:intent`.
 *
 * The clean phrases matter least. What is actually being tested here is the
 * damaged ones - dropped vowels, wrong vowels, and words the recogniser split
 * in half - because that is what a microphone in a field produces and it is
 * where a demo falls over. The refusal cases matter just as much: a parser
 * that guesses at a quantity it did not hear will book the wrong lot.
 */

import {
  detectCrop,
  parseBest,
  parseBookingIntent,
  phoneticKey,
  splitClauses,
} from '../src/lib/intent.js'

let passed = 0
let failed = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed += 1
  } else {
    failed += 1
    console.log(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    return
  }
  console.log(`  ok    ${label}`)
}

function parses(label, text, lang, cropId, quantityKg, dayEn) {
  const r = parseBookingIntent(text, lang)
  const actual = r.ok
    ? { cropId: r.cropId, quantityKg: r.quantity.quantityKg, day: r.dayLabelEn }
    : { failed: r.missing }
  check(label, actual, { cropId, quantityKg, day: dayEn })
}

console.log('\nClean speech, all three languages')
parses('hindi romanised', 'kal teen crate tamatar', 'hi', 'tomato', 75, 'Tomorrow')
parses('devanagari', 'परसों आठ बोरी आलू', 'hi', 'potato', 400, 'Day after tomorrow')
parses('gurmukhi', 'ਅੱਜ 50 ਕਿੱਲੋ ਪਿਆਜ਼', 'pa', 'onion', 50, 'Today')
parses('english', 'three crates of tomato tomorrow', 'en', 'tomato', 75, 'Tomorrow')

console.log('\nDamaged transcripts - what a real microphone returns')
parses('dropped vowel', 'kal teen crate tamatr', 'hi', 'tomato', 75, 'Tomorrow')
parses('wrong vowel', 'kal teen crate tomatoe', 'hi', 'tomato', 75, 'Tomorrow')
parses('word split in two', 'kal teen crate to matar', 'hi', 'tomato', 75, 'Tomorrow')
parses('misheard unit', 'kal teen kraet phulgobhi', 'hi', 'cauliflower', 75, 'Tomorrow')
parses('misspelt crop', 'aaj 50 kilo pyaaj', 'hi', 'onion', 50, 'Today')

console.log('\nMore than one order in one breath')
{
  const r = parseBookingIntent('kal teen crate tamatar aur do bori aloo', 'hi')
  check('two clauses found', r.items.length, 2)
  check(
    'both parsed',
    r.items.map((i) => [i.cropId, i.quantity.quantityKg]),
    [
      ['tomato', 75],
      ['potato', 100],
    ],
  )
  check('day shared across both', r.items.map((i) => i.dayLabelEn), ['Tomorrow', 'Tomorrow'])
}
{
  const r = parseBookingIntent('ਕੱਲ੍ਹ ਤਿੰਨ ਕਰੇਟ ਟਮਾਟਰ ਅਤੇ ਦੋ ਬੋਰੀ ਆਲੂ', 'pa')
  check('gurmukhi two clauses', r.items.map((i) => i.cropId), ['tomato', 'potato'])
}

console.log('\nRefusals - a parser that guesses is worse than one that asks')
check('gibberish is not a crop', detectCrop('kal teen crate zzzqqxx'), null)
check('missing crop is reported', parseBookingIntent('kal teen crate', 'hi').missing, ['crop'])
check('missing quantity is reported', parseBookingIntent('kal tamatar', 'hi').missing, ['quantity'])
check('empty input', parseBookingIntent('', 'hi').ok, false)
check(
  'short number words are not confused',
  parseBookingIntent('kal do bori aloo', 'hi').quantity.quantityKg,
  100,
)
check(
  'a stray conjunction is not a second order',
  splitClauses('aloo aur pyaaz dono chahiye').length,
  1,
)

console.log('\nPhonetic matching on the consonant skeleton')
check('spelling variants collapse to one key', [
  phoneticKey('tamatar'),
  phoneticKey('tamater'),
  phoneticKey('tamaatar'),
], [phoneticKey('tamatar'), phoneticKey('tamatar'), phoneticKey('tamatar')])
check('different words keep different keys', phoneticKey('aloo') !== phoneticKey('pyaaz'), true)
check('non-Latin script returns no key', phoneticKey('टमाटर'), '')
parses('unseen romanisation', 'kal teen crate tamattar', 'hi', 'tomato', 75, 'Tomorrow')
parses('phul gobhi variant', 'kal do crate fulgobi', 'hi', 'cauliflower', 50, 'Tomorrow')
parses('onion variant', 'aaj 50 kilo pyaj', 'hi', 'onion', 50, 'Today')

console.log('\nThe quantity binds to the unit, not to the first number heard')
parses('a time of day is not a quantity', 'paanch baje teen crate tamatar', 'hi', 'tomato', 75, 'Tomorrow')
parses('digits still win where they belong', 'kal 8 bori aloo 2 baje', 'hi', 'potato', 400, 'Tomorrow')

console.log('\nNumbers people actually say')
parses('twenty-five kilos', 'aaj pachees kilo pyaaz', 'hi', 'onion', 25, 'Today')
parses('a hundred kilos', 'kal sau kilo aloo', 'hi', 'potato', 100, 'Tomorrow')
parses('two hundred kilos', 'kal do sau kilo aloo', 'hi', 'potato', 200, 'Tomorrow')
parses('one and a half quintal', 'kal dedh quintal tamatar', 'hi', 'tomato', 150, 'Tomorrow')
parses('half a sack', 'aaj adha bora aloo', 'hi', 'potato', 25, 'Today')

console.log('\nN-best rescoring: the domain parser re-ranks the recogniser')
{
  // What Chrome plausibly returns for "kal teen crate tamatar": a confident
  // everyday-English reading first, and the real one further down.
  const alternatives = [
    { transcript: 'call teen create to matter', confidence: 0.91 },
    { transcript: 'kal teen crate tamatar', confidence: 0.62 },
  ]
  const best = parseBest(alternatives, 'hi')
  check('the booking-shaped candidate wins', [best.ok, best.cropId, best.quantity?.quantityKg],
    [true, 'tomato', 75])
  check('and it reports that it overruled the recogniser', best.rescored, true)
  check('every candidate is reported', best.considered.length, 2)
}
{
  const best = parseBest([{ transcript: 'kal teen crate tamatar', confidence: 0.9 }], 'hi')
  check('a single good candidate is not "rescored"', best.rescored, false)
}
check('no candidates at all fails cleanly', parseBest([], 'hi').ok, false)

console.log('\nProvenance is reported so the screen can ask for confirmation')
check('exact match is flagged exact', parseBookingIntent('kal teen crate tamatar', 'hi').exactCropMatch, true)
check(
  'a spelling not in the lexicon is flagged as approximate',
  parseBookingIntent('kal teen crate tamattar', 'hi').exactCropMatch,
  false,
)
check(
  'a doubled consonant is still a phonetic hit, not a fuzzy one',
  parseBookingIntent('kal teen crate tamattar', 'hi').matchedBy,
  'phonetic',
)
check(
  'a dropped consonant falls through to edit distance',
  parseBookingIntent('kal teen crate tamaar', 'hi').matchedBy,
  'fuzzy',
)
check(
  'a phonetic hit is named as one',
  parseBookingIntent('kal do crate fulgobhi', 'hi').matchedBy,
  'phonetic',
)

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
