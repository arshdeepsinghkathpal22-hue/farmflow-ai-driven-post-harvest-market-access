/**
 * Speech recognition.
 *
 * Uses the browser's own `SpeechRecognition`, which on Chrome and Edge is
 * Google's recogniser - a real neural ASR model with Hindi and Punjabi support
 * and no API key to manage. Where it is unavailable (Firefox, most iOS
 * browsers) `isSupported()` returns false and the voice screen falls back to a
 * scripted example, so the flow can still be demonstrated.
 *
 * The recogniser is asked for **several candidate transcripts** rather than
 * one. Its own first choice is tuned for general conversation, and general
 * conversation does not contain the word "bori". Asking for the n-best list and
 * letting the domain parser decide which candidate actually describes a booking
 * is a large accuracy win for almost no cost - this is n-best rescoring, and it
 * is what the parser in `intent.js` consumes.
 *
 * There is deliberately **no speech synthesis** here. An app that talks back
 * is a liability in a noisy mandi and an irritation everywhere else; the
 * confirmation is on the screen, in the farmer's own script, where it can be
 * read twice and checked.
 *
 * Everything here is defensive on purpose. A microphone is the one part of a
 * demo guaranteed to misbehave in a hall full of people.
 */

const Recognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined

/** How many candidate transcripts to ask for. Beyond about five they are noise. */
const ALTERNATIVES = 5

export function isSupported() {
  return Boolean(Recognition)
}

/** Human-readable reasons, because "not-allowed" helps nobody. */
const ERRORS = {
  'not-allowed': 'Microphone permission was refused. Allow it in the address bar and try again.',
  'service-not-allowed': 'Speech recognition is blocked in this browser.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs a network connection.',
  aborted: 'Listening stopped.',
  'no-speech': 'Nothing was heard. Try again, a little closer to the microphone.',
}

export function describeError(code) {
  return ERRORS[code] ?? 'The microphone could not be used. You can type instead.'
}

/**
 * Start listening.
 *
 * Returns a handle with `stop()`. Callbacks: `onPartial` fires as words arrive,
 * `onResult` once with `(bestTranscript, alternatives)` where `alternatives` is
 * the n-best list, each `{ transcript, confidence }`, most confident first.
 */
export function listen({ lang = 'hi-IN', onPartial, onResult, onError, onEnd } = {}) {
  if (!Recognition) {
    onError?.('This browser cannot listen. Chrome or Edge on Android and desktop can.')
    onEnd?.()
    return { stop() {}, supported: false }
  }

  const recognition = new Recognition()
  recognition.lang = lang
  recognition.interimResults = true
  recognition.continuous = false
  recognition.maxAlternatives = ALTERNATIVES

  let finished = false
  let best = ''
  // Keyed by transcript so the same wording arriving twice does not get two
  // votes when the parser comes to choose between candidates.
  const candidates = new Map()

  const remember = (transcript, confidence) => {
    const text = (transcript ?? '').trim()
    if (!text) return
    const previous = candidates.get(text) ?? 0
    candidates.set(text, Math.max(previous, confidence ?? 0))
  }

  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (result.isFinal) {
        best += result[0].transcript
        for (let j = 0; j < result.length; j += 1) {
          remember(result[j].transcript, result[j].confidence)
        }
      } else {
        interim += result[0].transcript
      }
    }
    onPartial?.((best + interim).trim())
  }

  recognition.onerror = (event) => {
    if (finished) return
    // "no-speech" after a real transcript is not a failure worth reporting.
    if (event.error === 'no-speech' && best.trim()) return
    finished = true
    onError?.(describeError(event.error))
  }

  recognition.onend = () => {
    if (!finished) {
      finished = true
      const transcript = best.trim()
      if (transcript) {
        remember(transcript, 1)
        const alternatives = [...candidates.entries()]
          .map(([text, confidence]) => ({ transcript: text, confidence }))
          .sort((a, b) => b.confidence - a.confidence)
        onResult?.(transcript, alternatives)
      } else {
        onError?.(describeError('no-speech'))
      }
    }
    onEnd?.()
  }

  try {
    recognition.start()
  } catch {
    // Calling start() twice throws; treat it as already listening.
    finished = true
    onError?.('Already listening.')
    onEnd?.()
  }

  return {
    supported: true,
    stop() {
      try {
        recognition.stop()
      } catch {
        /* already stopped */
      }
    },
  }
}
