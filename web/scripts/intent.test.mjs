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

console.log('\nSpoken calendar dates')
{
  // Expected offsets are computed, not hard-coded, so the tests do not rot as
  // the calendar moves underneath them.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const offsetTo = (monthIndex, dayNum, roll = 'year') => {
    let t = new Date(today.getFullYear(), monthIndex, dayNum)
    if (t < today)
      t = roll === 'year'
        ? new Date(today.getFullYear() + 1, monthIndex, dayNum)
        : new Date(today.getFullYear(), monthIndex + 1, dayNum)
    return Math.round((t - today) / 86400000)
  }

  const en = parseBookingIntent('Three crates of tomato on 26 september', 'en')
  check('an English date books the right day', { day: en.day, offset: en.dayOffset }, { day: 'date', offset: offsetTo(8, 26) })
  check('and the date number is not eaten as a quantity', en.quantity.quantityKg, 75)

  const hi = parseBookingIntent('26 सितंबर को तीन क्रेट टमाटर', 'hi')
  check('a Hindi date books the same day', { day: hi.day, offset: hi.dayOffset, kg: hi.quantity.quantityKg }, { day: 'date', offset: offsetTo(8, 26), kg: 75 })

  const dev = parseBookingIntent('२६ सितंबर को दो बोरी आलू', 'hi')
  check('Devanagari digits are read as digits', { day: dev.day, offset: dev.dayOffset }, { day: 'date', offset: offsetTo(8, 26) })

  const pa = parseBookingIntent('ਦੋ ਬੋਰੀ ਆਲੂ 5 ਅਕਤੂਬਰ', 'pa')
  check('a Punjabi date parses', { day: pa.day, offset: pa.dayOffset }, { day: 'date', offset: offsetTo(9, 5) })

  const tarikh = parseBookingIntent('do bori aloo 15 tarikh', 'hi')
  check('a bare tarikh lands this month or rolls to the next', { day: tarikh.day, offset: tarikh.dayOffset }, { day: 'date', offset: offsetTo(today.getMonth(), 15, 'month') })

  const monthFirst = parseBookingIntent('august 30 one quintal onion', 'en')
  check('month-first order works too', { day: monthFirst.day, kg: monthFirst.quantity.quantityKg }, { day: 'date', kg: 100 })

  const chilli = parseBookingIntent('shimla mirch teen crate kal', 'hi')
  check('"mirch" is a chilli, never the month of March', { crop: chilli.cropId, day: chilli.day }, { crop: 'capsicum', day: 'tomorrow' })
}

console.log('\nRelative pickup days ("X days from now")')
{
  const rel = (text, lang) => {
    const r = parseBookingIntent(text, lang)
    return r.ok ? { day: r.day, offset: r.dayOffset, kg: r.quantity.quantityKg } : { failed: r.missing }
  }
  check('English "four days from now"', rel('book three crates of tomato four days from now', 'en'), { day: 'date', offset: 4, kg: 75 })
  check('Hindi "chaar din baad"', rel('chaar din baad teen crate tamatar', 'hi'), { day: 'date', offset: 4, kg: 75 })
  check('Devanagari "चार दिन बाद"', rel('चार दिन बाद तीन क्रेट टमाटर', 'hi'), { day: 'date', offset: 4, kg: 75 })
  check('Punjabi "ਚਾਰ ਦਿਨ ਬਾਅਦ"', rel('ਚਾਰ ਦਿਨ ਬਾਅਦ ਦੋ ਬੋਰੀ ਆਲੂ', 'pa'), { day: 'date', offset: 4, kg: 100 })
  check('English "after 5 days"', rel('after 5 days two sacks of potato', 'en'), { day: 'date', offset: 5, kg: 100 })
  check('Hindi "4 din me"', rel('do bori aloo 4 din me', 'hi'), { day: 'date', offset: 4, kg: 100 })
  check('a word-number date: "chhabbis august"', (() => {
    const r = parseBookingIntent('chhabbis august ko do bori aloo', 'hi')
    return { day: r.day, label: r.dayLabelEn, kg: r.quantity.quantityKg }
  })(), { day: 'date', label: '26 Aug', kg: 100 })
  check('a bare "chaar din" without a marker is NOT a date', (() => {
    const r = parseBookingIntent('chaar din teen crate tamatar', 'hi')
    return r.day
  })(), 'tomorrow')

  const partial = parseBookingIntent('book the tomato cold storage for four days from now', 'en')
  check('crop and day survive a missing quantity', { ok: partial.ok, missing: partial.missing, crop: partial.cropId, day: partial.day, offset: partial.dayOffset }, { ok: false, missing: ['quantity'], crop: 'tomato', day: 'date', offset: 4 })

  const kal = parseBookingIntent('kal teen crate tamatar', 'hi')
  check('every relative day resolves to a real date', typeof kal.dayDateShort === 'string' && /\d+ \w+/.test(kal.dayDateShort), true)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
