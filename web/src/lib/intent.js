/**
 * Turning speech into a booking.
 *
 * The recogniser listens in the farmer's own language and returns Devanagari,
 * Gurmukhi or Latin text. That text is parsed **directly** by a domain lexicon
 * rather than translated to English first: a translation hop is another thing
 * to fail on stage, it needs a network, and it mangles exactly the phrases we
 * care about - "3 crate tamatar" is farm vocabulary, not conversation.
 *
 * Four things make this survive a real microphone rather than only clean test
 * strings.
 *
 * **1. Phonetic matching on the consonant skeleton.** Romanised Hindi and
 * Punjabi have no fixed spelling. The same word arrives as "tamatar",
 * "tamater", "tamaatar" or "tomato" depending on the recogniser's mood, and
 * what stays constant across every one of them is the consonants. Stripping
 * vowels and normalising the consonants that Indic romanisation confuses
 * (c/k/q, ph/f, v/w, j/z) reduces all four to the same key. This catches
 * variants that edit distance alone would refuse.
 *
 * **2. Edit distance, as a second pass with a tight budget.** Scaled to word
 * length, and **zero at four characters or fewer** - at three characters one
 * substitution turns *das* (ten) into *do* (two), and a parser that accepts
 * that books a fifth of what the farmer asked for.
 *
 * **3. Proximity binding.** The quantity is bound to the unit standing nearest
 * to it, not to the first number in the sentence. "paanch baje teen crate
 * tamatar" is three crates at five o'clock, not five of anything.
 *
 * **4. N-best rescoring.** The recogniser returns several candidate
 * transcripts. Its own ranking is tuned for general speech; ours is tuned for
 * bookings. Every candidate is parsed and the one that yields the most complete
 * booking wins - see `parseBest`.
 *
 * A parser that guesses is worse than one that asks again, so every stage
 * refuses rather than approximates when it is not sure.
 */

// Explicit extension so this module also runs under plain Node, which is what
// lets `npm run test:intent` work without spinning up a bundler.
import { CROPS } from '../data/seed.js'

/** Spoken forms per crop, across all three languages and common romanisations. */
const CROP_WORDS = {
  tomato: [
    'tomato', 'tomatoes', 'tamatar', 'tamaatar', 'tamater', 'tamatr',
    'टमाटर', 'टमाटर्स', 'ਟਮਾਟਰ',
  ],
  potato: ['potato', 'potatoes', 'aloo', 'alu', 'aalu', 'batata', 'आलू', 'ਆਲੂ'],
  onion: [
    'onion', 'onions', 'pyaaz', 'pyaz', 'piyaz', 'pyaj', 'kanda', 'dungri',
    'प्याज', 'प्याज़', 'ਪਿਆਜ਼', 'ਪਿਆਜ',
  ],
  capsicum: [
    'capsicum', 'bell pepper', 'bellpepper', 'shimla', 'shimla mirch', 'simla mirch',
    'shimlamirch', 'शिमला मिर्च', 'शिमला', 'ਸ਼ਿਮਲਾ ਮਿਰਚ', 'ਸ਼ਿਮਲਾ',
  ],
  cauliflower: [
    'cauliflower', 'gobhi', 'gobi', 'phulgobhi', 'phoolgobhi', 'fulgobi',
    'फूलगोभी', 'गोभी', 'ਫੁੱਲ ਗੋਭੀ', 'ਗੋਭੀ',
  ],
}

/**
 * Number words.
 *
 * Extended well past ten because farmers do not round to convenient figures -
 * "pachees kilo" and "sau kilo" are ordinary things to say, and a parser that
 * only knows up to twenty simply fails on them.
 */
const NUMBER_WORDS = {
  1: ['one', 'ek', 'एक', 'ਇੱਕ', 'ਇਕ'],
  2: ['two', 'do', 'दो', 'ਦੋ'],
  3: ['three', 'teen', 'tin', 'तीन', 'ਤਿੰਨ'],
  4: ['four', 'char', 'chaar', 'चार', 'ਚਾਰ'],
  5: ['five', 'paanch', 'panch', 'पांच', 'पाँच', 'ਪੰਜ'],
  6: ['six', 'chah', 'chhe', 'छह', 'छे', 'ਛੇ'],
  7: ['seven', 'saat', 'सात', 'ਸੱਤ'],
  8: ['eight', 'aath', 'आठ', 'ਅੱਠ'],
  9: ['nine', 'nau', 'नौ', 'ਨੌਂ', 'ਨੌ'],
  10: ['ten', 'das', 'दस', 'ਦਸ'],
  11: ['eleven', 'gyarah', 'ग्यारह', 'ਗਿਆਰਾਂ'],
  12: ['twelve', 'barah', 'बारह', 'ਬਾਰਾਂ'],
  13: ['thirteen', 'terah', 'तेरह', 'ਤੇਰਾਂ'],
  14: ['fourteen', 'chaudah', 'चौदह', 'ਚੌਦਾਂ'],
  15: ['fifteen', 'pandrah', 'पंद्रह', 'ਪੰਦਰਾਂ'],
  16: ['sixteen', 'solah', 'सोलह', 'ਸੋਲਾਂ'],
  17: ['seventeen', 'satrah', 'सत्रह', 'ਸਤਾਰਾਂ'],
  18: ['eighteen', 'atharah', 'अठारह', 'ਅਠਾਰਾਂ'],
  19: ['nineteen', 'unnis', 'उन्नीस', 'ਉੱਨੀ'],
  20: ['twenty', 'bees', 'बीस', 'ਵੀਹ'],
  25: ['twentyfive', 'pachees', 'pachchees', 'पच्चीस', 'ਪੰਝੀ'],
  30: ['thirty', 'tees', 'तीस', 'ਤੀਹ'],
  40: ['forty', 'chalees', 'चालीस', 'ਚਾਲੀ'],
  50: ['fifty', 'pachas', 'pachaas', 'पचास', 'ਪੰਜਾਹ'],
  60: ['sixty', 'saath', 'साठ', 'ਸੱਠ'],
  75: ['seventyfive', 'pachhattar', 'पचहत्तर'],
  100: ['hundred', 'sau', 'सौ', 'ਸੌ'],
}

/**
 * Fractional quantifiers, which Indian farm speech uses constantly.
 *
 * "dedh quintal" is a hundred and fifty kilos and it is a completely ordinary
 * thing to say. Without these the parser either fails outright or, worse,
 * silently drops the fraction and books two thirds of the lot.
 */
const FRACTION_WORDS = {
  0.5: ['adha', 'aadha', 'half', 'आधा', 'ਅੱਧਾ'],
  0.75: ['paune', 'पौने', 'ਪੌਣੇ'],
  1.25: ['sawa', 'सवा', 'ਸਵਾ'],
  1.5: ['dedh', 'derh', 'डेढ़', 'ਡੇਢ'],
  2.5: ['dhai', 'ढाई', 'ਢਾਈ'],
}

/**
 * Units and what one of them weighs.
 *
 * A crate and a sack are how produce is actually counted at the farm gate;
 * the kilogram conversions are the ones traders use.
 */
const UNITS = [
  { id: 'crate', kg: 25, words: ['crate', 'crates', 'karet', 'क्रेट', 'ਕਰੇਟ', 'peti', 'पेटी', 'ਪੇਟੀ'] },
  { id: 'sack', kg: 50, words: ['sack', 'sacks', 'bori', 'bora', 'बोरी', 'बोरा', 'ਬੋਰੀ', 'ਬੋਰਾ'] },
  { id: 'quintal', kg: 100, words: ['quintal', 'quintals', 'kuntal', 'क्विंटल', 'कुंतल', 'ਕੁਇੰਟਲ'] },
  { id: 'kg', kg: 1, words: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'किलो', 'किलोग्राम', 'ਕਿੱਲੋ', 'ਕਿਲੋ'] },
]

/** Pickup day, in the words people actually say. */
const DAYS = [
  { offset: 0, id: 'today', words: ['today', 'aaj', 'abhi', 'आज', 'अभी', 'ਅੱਜ', 'ਹੁਣੇ'] },
  { offset: 1, id: 'tomorrow', words: ['tomorrow', 'kal', 'kall', 'कल', 'ਕੱਲ੍ਹ', 'ਕੱਲ'] },
  { offset: 2, id: 'dayAfter', words: ['parso', 'parson', 'parsoon', 'परसों', 'ਪਰਸੋਂ', 'day after'] },
]

const DAY_LABELS = {
  today: { en: 'Today', hi: 'आज', pa: 'ਅੱਜ' },
  tomorrow: { en: 'Tomorrow', hi: 'कल', pa: 'ਕੱਲ੍ਹ' },
  dayAfter: { en: 'Day after tomorrow', hi: 'परसों', pa: 'ਪਰਸੋਂ' },
}

/** Words that separate one order from the next inside a single sentence. */
const CONJUNCTIONS = ['aur', 'और', 'ਅਤੇ', 'and', 'plus', 'ate', 'tey']

/* ── Text handling ────────────────────────────────────────────────────────── */

/** Lower-case, collapse whitespace, and strip punctuation the recogniser adds. */
function normalise(text) {
  return ` ${String(text ?? '')
    .toLowerCase()
    .replace(/[.,!?;:()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `
}

const tokenise = (text) => normalise(text).trim().split(/\s+/).filter(Boolean)

const isLatin = (word) => /^[a-z0-9]+$/.test(word)

/**
 * The consonant skeleton of a romanised word.
 *
 * Vowels carry almost no information in transliterated Hindi and Punjabi -
 * they are exactly what varies between one spelling and the next - so they are
 * dropped, and the consonants that Indic romanisation routinely swaps are
 * folded together. Returns an empty string for anything not in Latin script,
 * because Devanagari and Gurmukhi are matched exactly and do not need this.
 */
export function phoneticKey(word) {
  const w = String(word ?? '').toLowerCase()
  if (!isLatin(w)) return ''

  return (
    w
      // Digraphs first, before their letters are considered individually.
      // `sh` and `ch` become sentinels so the c-to-k fold further down cannot
      // reach inside them - "chawal" and "kawal" are not the same word.
      .replace(/ph/g, 'f')
      .replace(/sh/g, '')
      .replace(/ch/g, '')
      .replace(/kh/g, 'k')
      .replace(/gh/g, 'g')
      .replace(/th/g, 't')
      .replace(/dh/g, 'd')
      .replace(/bh/g, 'b')
      // Remaining aspiration survives nothing. `y` is kept: it is a real
      // consonant in "pyaaz", and dropping it would leave only two letters.
      .replace(/h/g, '')
      // Consonants that Indic romanisation treats as interchangeable.
      .replace(/[ckq]/g, 'k')
      .replace(/[vw]/g, 'v')
      .replace(/[jz]/g, 'j')
      .replace(//g, 's')
      .replace(//g, 'c')
      .replace(/[aeiou]/g, '')
      // "tamatar" and "tammatar" are the same word.
      .replace(/(.)\1+/g, '$1')
  )
}

/**
 * The shortest consonant skeleton worth trusting.
 *
 * Two consonants is not evidence. It is how "kal" (tomorrow) and "kilo" collide
 * on `k-l`, and "bora" (a sack) and "barah" (twelve) collide on `b-r` - and a
 * parser that accepts either of those reads the sentence completely wrong while
 * looking confident about it. Words this short are matched exactly or not at
 * all, which is fine, because short words are also the ones whose spelling
 * barely varies.
 */
const MIN_SKELETON = 3

/**
 * Levenshtein distance, abandoned as soon as it cannot come in under `max`.
 *
 * The early exit matters: this runs over every lexicon word on every partial
 * transcript the recogniser emits while someone is still speaking.
 */
export function editDistance(a, b, max) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    let rowBest = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      if (row[j] < rowBest) rowBest = row[j]
    }
    // Every remaining cell can only grow from here, so this row's best is a
    // lower bound on the final answer.
    if (rowBest > max) return max + 1
    prev = row
  }
  return prev[b.length]
}

/**
 * How wrong a word is allowed to be before we stop believing it.
 *
 * Short words get no slack at all: at three characters, one substitution turns
 * "das" (ten) into "do" (two), and a parser that cheerfully accepts that will
 * book a fifth of what the farmer asked for.
 */
function budgetFor(word) {
  if (word.length <= 4) return 0
  if (word.length <= 7) return 1
  return 2
}

/**
 * Every candidate the transcript offers, with the position it starts at: each
 * word, and each adjacent pair joined up. The pairs are what recover a word the
 * recogniser split in half.
 */
function candidates(tokens, skip) {
  const free = (i, span) => {
    for (let k = 0; k < span; k += 1) if (skip?.has(i + k)) return false
    return true
  }

  const out = []
  tokens.forEach((text, index) => {
    if (free(index, 1)) out.push({ text, index, span: 1 })
  })
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (free(i, 2)) out.push({ text: tokens[i] + tokens[i + 1], index: i, span: 2 })
  }
  return out
}

/**
 * Find the best match for any of `words` among the transcript's tokens.
 *
 * Three passes, strongest evidence first: an exact hit, then a phonetic hit on
 * the consonant skeleton, then edit distance inside its budget. Returns null
 * when nothing comes close enough to be trusted.
 */
function findWord(tokens, words, skip) {
  const grams = candidates(tokens, skip)

  // Pass 1 - exact.
  for (const raw of words) {
    const needle = raw.toLowerCase().replace(/\s+/g, '')
    const hit = grams.find((g) => g.text === needle)
    if (hit) return { word: raw, index: hit.index, span: hit.span, how: 'exact', distance: 0 }
  }

  // Pass 2 - same consonant skeleton. Skeletons shorter than two consonants
  // carry too little information to be evidence of anything.
  for (const raw of words) {
    const key = phoneticKey(raw)
    if (key.length < MIN_SKELETON) continue
    const hit = grams.find((g) => phoneticKey(g.text) === key)
    if (hit) return { word: raw, index: hit.index, span: hit.span, how: 'phonetic', distance: 0 }
  }

  // Pass 3 - near enough, under a budget.
  let best = null
  for (const raw of words) {
    const needle = raw.toLowerCase().replace(/\s+/g, '')
    const budget = budgetFor(needle)
    if (budget === 0) continue
    for (const gram of grams) {
      const d = editDistance(gram.text, needle, budget)
      if (d <= budget && (best === null || d < best.distance)) {
        best = { word: raw, index: gram.index, span: gram.span, how: 'fuzzy', distance: d }
      }
    }
  }
  return best
}

/* ── Field detection ──────────────────────────────────────────────────────── */

/**
 * Read one clause, in precedence order, consuming tokens as it goes.
 *
 * The order is not arbitrary and the consumption is not an optimisation - it is
 * what stops one word being counted as two different things. "kal do bori aloo"
 * contains `kal`, which is Tuesday-tomorrow, and it is also two letters away
 * from `kilo`; and `bora`, which is a sack, and is also two letters away from
 * `barah`, twelve. Reading the sentence field by field and striking out each
 * word as it is claimed means `kal` can only ever be the day and `bora` can only
 * ever be the unit.
 *
 * Days go first because they are the smallest closed class and the least
 * ambiguous. Units next, because the unit is what the quantity has to attach
 * to. Numbers after that, then whatever is left is the crop.
 */
function analyseClause(text) {
  const tokens = tokenise(text)
  const used = new Set()

  const claim = (hit) => {
    if (!hit) return hit
    for (let k = 0; k < hit.span; k += 1) used.add(hit.index + k)
    return hit
  }

  // 1 · Day.
  let day = null
  for (const d of DAYS) {
    const hit = findWord(tokens, d.words, used)
    if (hit) {
      claim(hit)
      day = d
      break
    }
  }

  // 2 · Unit. Longest lexicon word first, so "kilogram" beats "kilo".
  const byLength = [...UNITS].sort(
    (a, b) => Math.max(...b.words.map((w) => w.length)) - Math.max(...a.words.map((w) => w.length)),
  )
  let unit = null
  let unitIndex = -1
  for (const u of byLength) {
    const hit = findWord(tokens, u.words, used)
    if (hit) {
      claim(hit)
      unit = u
      unitIndex = hit.index
      break
    }
  }

  // 3 · Numbers, whole and fractional.
  const numbers = []
  tokens.forEach((token, index) => {
    if (!used.has(index) && /^\d{1,4}(\.\d+)?$/.test(token)) {
      numbers.push({ value: Number(token), index, kind: 'digit' })
      used.add(index)
    }
  })
  for (const [value, words] of Object.entries(NUMBER_WORDS)) {
    const hit = findWord(tokens, words, used)
    if (hit) {
      claim(hit)
      numbers.push({ value: Number(value), index: hit.index, kind: 'word' })
    }
  }
  for (const [value, words] of Object.entries(FRACTION_WORDS)) {
    const hit = findWord(tokens, words, used)
    if (hit) {
      claim(hit)
      numbers.push({ value: Number(value), index: hit.index, kind: 'fraction' })
    }
  }
  numbers.sort((a, b) => a.index - b.index)

  // "do sau" is two hundred, not a two followed by a hundred.
  const hundred = numbers.find((n) => n.value === 100 && n.kind === 'word')
  if (hundred) {
    const multiplier = numbers.find(
      (n) => n !== hundred && n.index < hundred.index && n.value >= 2 && n.value < 100,
    )
    if (multiplier) {
      hundred.value *= multiplier.value
      numbers.splice(numbers.indexOf(multiplier), 1)
    }
  }

  // 4 · Crop, from whatever is left.
  let crop = null
  for (const [cropId, words] of Object.entries(CROP_WORDS)) {
    const hit = findWord(tokens, words, used)
    if (!hit) continue
    const rank = { exact: 0, phonetic: 1, fuzzy: 2 }[hit.how]
    const better =
      crop === null || rank < crop.rank || (rank === crop.rank && hit.word.length > crop.word.length)
    if (better) crop = { cropId, rank, ...hit }
  }
  if (crop) claim(crop)

  return { tokens, day, unit, unitIndex, numbers, crop }
}

/**
 * Bind a number to a unit by proximity.
 *
 * Taking the first number in the sentence is wrong often enough to matter:
 * "paanch baje teen crate tamatar" is three crates at five o'clock, and reading
 * it as five books nearly double the lot. The number standing closest to the
 * unit wins, and one said *before* the unit beats one said after it at equal
 * distance, because "teen crate" is how people speak.
 */
function bindQuantity({ unit, unitIndex, numbers }) {
  if (!numbers.length && !unit) return null

  let count = null
  if (numbers.length) {
    if (unitIndex >= 0) {
      const scored = numbers.map((n) => ({
        n,
        cost: Math.abs(n.index - unitIndex) + (n.index > unitIndex ? 0.5 : 0),
      }))
      scored.sort((a, b) => a.cost - b.cost)
      count = scored[0].n.value
    } else {
      count = numbers[0].value
    }
  }

  const resolvedUnit = unit ?? UNITS.find((u) => u.id === 'crate')
  const resolvedCount = count ?? 1

  return {
    count: resolvedCount,
    unit: resolvedUnit.id,
    unitKg: resolvedUnit.kg,
    quantityKg: Math.round(resolvedCount * resolvedUnit.kg * 100) / 100,
    // A bare number with no unit is a guess, and the UI says so.
    assumedUnit: unit === null,
  }
}

/** Reports how the match was made, so the screen can ask for confirmation. */
export function detectCropDetailed(text) {
  const { crop } = analyseClause(text)
  if (!crop) return null
  return {
    cropId: crop.cropId,
    exact: crop.how === 'exact',
    how: crop.how,
    heard: crop.word,
    index: crop.index,
    distance: crop.distance,
  }
}

export function detectCrop(text) {
  return analyseClause(text).crop?.cropId ?? null
}

export function detectQuantity(text) {
  return bindQuantity(analyseClause(text))
}

export function detectDay(text) {
  return analyseClause(text).day ?? DAYS.find((d) => d.id === 'tomorrow')
}

/* ── Sentences with more than one order in them ───────────────────────────── */

/**
 * Split "teen crate tamatar aur do bori aloo" into its two halves.
 *
 * A clause only counts as a separate order if it names both a crop and a
 * quantity. "aloo aur pyaaz dono chahiye" names two crops and no amount, so it
 * is one sentence with a stray conjunction rather than two bookings; splitting
 * it would invent an order nobody placed. The stricter rule is the safe one:
 * the cost of a missed split is one more sentence, and the cost of a wrong
 * split is a truck.
 */
export function splitClauses(text) {
  const tokens = tokenise(text)
  const cuts = []
  tokens.forEach((token, i) => {
    if (CONJUNCTIONS.includes(token) && i > 0 && i < tokens.length - 1) cuts.push(i)
  })
  if (cuts.length === 0) return [String(text ?? '').trim()].filter(Boolean)

  const parts = []
  let start = 0
  for (const cut of cuts) {
    parts.push(tokens.slice(start, cut).join(' '))
    start = cut + 1
  }
  parts.push(tokens.slice(start).join(' '))

  const orders = parts.filter((p) => detectCrop(p) && detectQuantity(p))
  return orders.length >= 2 ? orders : [String(text ?? '').trim()]
}

/* ── The parser the screens call ──────────────────────────────────────────── */

function parseClause(text, lang, fallbackDay) {
  // One pass, so the day, the unit, the number and the crop all agree about
  // which word was which.
  const read = analyseClause(text)
  const cropId = read.crop?.cropId ?? null
  const quantity = bindQuantity(read)
  const day = read.day ?? fallbackDay ?? DAYS.find((d) => d.id === 'tomorrow')

  const missing = []
  if (!cropId) missing.push('crop')
  if (!quantity) missing.push('quantity')

  return {
    ok: missing.length === 0,
    missing,
    transcript: String(text ?? '').trim(),
    cropId,
    crop: cropId ? CROPS.find((c) => c.id === cropId) : null,
    // False when the recogniser had to be given the benefit of the doubt, so
    // the screen can show the crop name for confirmation rather than assume it.
    exactCropMatch: read.crop?.how === 'exact',
    matchedBy: read.crop?.how ?? null,
    heardAs: read.crop?.word ?? null,
    quantity,
    day: day.id,
    dayOffset: day.offset,
    dayLabel: DAY_LABELS[day.id][lang] ?? DAY_LABELS[day.id].en,
    dayLabelEn: DAY_LABELS[day.id].en,
  }
}

/**
 * Parse a spoken phrase into a booking.
 *
 * Returns what it understood plus what it could not, so the screen can ask for
 * the missing piece instead of silently guessing. When the sentence contained
 * more than one order, `items` holds all of them and the top-level fields
 * describe the first.
 */
export function parseBookingIntent(text, lang = 'hi') {
  const transcript = String(text ?? '').trim()
  if (!transcript) {
    return { ok: false, missing: ['crop', 'quantity'], transcript: '', items: [] }
  }

  const clauses = splitClauses(transcript)

  if (clauses.length === 1) {
    const single = parseClause(transcript, lang)
    return { ...single, transcript, items: single.ok ? [single] : [] }
  }

  // The day is usually said once for the whole sentence - "kal teen crate
  // tamatar aur do bori aloo" means both tomorrow, not one tomorrow and one
  // defaulted. So it is resolved across the full transcript and shared.
  const sharedDay = detectDay(transcript)
  const items = clauses.map((c) => parseClause(c, lang, sharedDay)).filter((i) => i.ok)

  if (items.length === 0) {
    const single = parseClause(transcript, lang)
    return { ...single, transcript, items: [] }
  }

  return { ...items[0], transcript, items }
}

/**
 * How good a parse is, as a number.
 *
 * Used to choose between the recogniser's candidate transcripts. Exact evidence
 * outranks approximate evidence, a stated unit outranks an assumed one, and the
 * recogniser's own confidence is worth something but not much - it is scoring
 * "does this sound like English", and we are asking "is this a booking".
 */
export function scoreParse(parsed, asrConfidence = 0) {
  if (!parsed) return 0
  let score = 0

  if (parsed.cropId) score += parsed.matchedBy === 'exact' ? 50 : parsed.matchedBy === 'phonetic' ? 42 : 34
  if (parsed.quantity) score += parsed.quantity.assumedUnit ? 18 : 30
  if (parsed.day !== 'tomorrow') score += 8 // an explicitly stated day
  if (parsed.items?.length > 1) score += 8 * (parsed.items.length - 1)

  score += Math.max(0, Math.min(1, asrConfidence)) * 10
  return score
}

/**
 * Choose between the recogniser's candidate transcripts and parse the winner.
 *
 * `alternatives` is the n-best list, each `{ transcript, confidence }`. The
 * recogniser ranks them by how likely they are as speech; we re-rank them by
 * how completely they describe a booking, which is a different and, here, more
 * useful question. Returns the winning parse with the candidates attached so
 * the screen can show what else was considered.
 */
export function parseBest(alternatives, lang = 'hi') {
  const list = (Array.isArray(alternatives) ? alternatives : [])
    .map((a) => (typeof a === 'string' ? { transcript: a, confidence: 0 } : a))
    .filter((a) => a?.transcript?.trim())

  if (!list.length) return { ...parseBookingIntent('', lang), considered: [] }

  const scored = list.map((alt) => {
    const parsed = parseBookingIntent(alt.transcript, lang)
    return { ...alt, parsed, score: scoreParse(parsed, alt.confidence) }
  })
  scored.sort((a, b) => b.score - a.score)

  const winner = scored[0]
  return {
    ...winner.parsed,
    // True when the domain parser overruled the recogniser's own first choice,
    // which is the whole reason for asking for alternatives.
    rescored: winner.transcript !== list[0].transcript,
    considered: scored.map((s) => ({
      transcript: s.transcript,
      confidence: s.confidence,
      score: s.score,
      ok: s.parsed.ok,
    })),
  }
}

/** Example phrases shown on the voice screen, in the chosen language. */
export const EXAMPLES = {
  en: [
    'Three crates of tomato tomorrow',
    'Eight sacks of potato day after',
    '50 kg onion today',
    'Three crates of tomato and two sacks of potato tomorrow',
  ],
  hi: [
    'कल तीन क्रेट टमाटर',
    'परसों आठ बोरी आलू',
    'आज 50 किलो प्याज़',
    'कल तीन क्रेट टमाटर और दो बोरी आलू',
  ],
  pa: [
    'ਕੱਲ੍ਹ ਤਿੰਨ ਕਰੇਟ ਟਮਾਟਰ',
    'ਪਰਸੋਂ ਅੱਠ ਬੋਰੀ ਆਲੂ',
    'ਅੱਜ 50 ਕਿੱਲੋ ਪਿਆਜ਼',
    'ਕੱਲ੍ਹ ਤਿੰਨ ਕਰੇਟ ਟਮਾਟਰ ਅਤੇ ਦੋ ਬੋਰੀ ਆਲੂ',
  ],
}

export { UNITS, DAY_LABELS }
