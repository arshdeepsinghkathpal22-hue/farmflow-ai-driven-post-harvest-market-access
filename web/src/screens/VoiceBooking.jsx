import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  Mic,
  MicOff,
  Snowflake,
  Sparkles,
  Square,
  Tractor,
  Weight,
} from 'lucide-react'
import { useApp } from '../store/context'
import { LANGUAGES } from '../i18n/languages'
import { DAY_LABELS, EXAMPLES, parseBest, parseBookingIntent } from '../lib/intent'
import { addDays, dateShort } from '../lib/format'
import { isSupported, listen } from '../lib/speech'
import { matchStorages } from '../lib/ai'
import { kg, rupee } from '../lib/format'
import { Bilingual, Card, Chip } from '../components/ui'

const IDLE = 'idle'
const LISTENING = 'listening'
const PARSED = 'parsed'

export default function VoiceBooking() {
  const { createBooking, notify, online, lang, langMeta, setLanguage } = useApp()
  const navigate = useNavigate()

  const [phase, setPhase] = useState(IDLE)
  const [heard, setHeard] = useState('')
  const [parsed, setParsed] = useState(null)
  // The farmer's correction of the pickup day, when the parse got it wrong or
  // the plan changed: { dayId, offset } for the three spoken days, or
  // { date: 'YYYY-MM-DD' } for any calendar date.
  const [pickupChoice, setPickupChoice] = useState(null)
  const [error, setError] = useState(null)
  const [exampleIndex, setExampleIndex] = useState(0)
  const [typed, setTyped] = useState('')
  // A parse that understood the crop and the day but not the quantity. The
  // parser refuses to guess a lot size - rightly - so the screen asks with
  // four chips instead of throwing the whole sentence away.
  const [partial, setPartial] = useState(null)

  const session = useRef(null)
  const submitting = useRef(false)
  const supported = isSupported()

  // Never leave the microphone open when the screen goes away.
  useEffect(() => () => session.current?.stop(), [])

  /**
   * Turn what was heard into a booking.
   *
   * When the recogniser offered alternatives, all of them are parsed and the
   * one that describes the most complete booking wins - the recogniser ranks
   * candidates by how likely they are as speech, which is not the same question
   * as which one is an order.
   */
  const interpret = (transcript, alternatives) => {
    const intent =
      alternatives?.length > 1 ? parseBest(alternatives, lang) : parseBookingIntent(transcript, lang)

    setHeard(intent.transcript || transcript)

    if (!intent.ok) {
      if (!intent.missing.includes('crop') && intent.cropId) {
        // Everything but the quantity was understood - keep it and ask.
        setPartial(intent)
        setError(null)
        setPhase(IDLE)
        return
      }
      const missing = intent.missing.includes('crop')
        ? 'Which crop was that? Try naming the crop and how much.'
        : 'How much was that? Try saying a number and a unit, like three crates.'
      setError(missing)
      setPartial(null)
      setPhase(IDLE)
      return
    }
    setPartial(null)

    const matches = matchStorages(intent.cropId, intent.quantity.quantityKg)
    const storage = matches.find((m) => m.acceptsLot) ?? matches[0]

    setParsed({ ...intent, storage })
    setPickupChoice(null)
    setError(null)
    setPhase(PARSED)
  }

  const start = () => {
    setError(null)
    setHeard('')
    setParsed(null)
    setPartial(null)
    setPhase(LISTENING)

    session.current = listen({
      lang: langMeta.speech,
      onPartial: setHeard,
      onResult: interpret,
      onError: (message) => {
        setError(message)
        setPhase(IDLE)
      },
      onEnd: () => {
        session.current = null
        setPhase((p) => (p === LISTENING ? IDLE : p))
      },
    })
  }

  const stop = () => {
    session.current?.stop()
    setPhase(IDLE)
  }

  /** Runs a written example through the very same parser as live speech. */
  const runExample = () => {
    const phrases = EXAMPLES[lang] ?? EXAMPLES.en
    const phrase = phrases[exampleIndex % phrases.length]
    setExampleIndex((i) => i + 1)
    interpret(phrase)
  }

  const confirm = () => {
    if (submitting.current || !parsed) return
    submitting.current = true

    let pickup = parsed.dayLabelEn
    let pickupOffset = parsed.dayOffset
    let pickupDayId = parsed.day
    if (pickupChoice?.date) {
      const chosen = new Date(`${pickupChoice.date}T00:00:00`)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      pickupOffset = Math.max(0, Math.round((chosen - today) / 86400000))
      pickup = dateShort(chosen)
      pickupDayId = null
    } else if (pickupChoice) {
      pickupOffset = pickupChoice.offset
      pickupDayId = pickupChoice.dayId
      pickup = DAY_LABELS[pickupChoice.dayId].en
    }

    const booking = createBooking({
      cropId: parsed.cropId,
      quantityKg: parsed.quantity.quantityKg,
      storageId: parsed.storage.id,
      pickup,
      pickupOffset,
      pickupDayId,
      holdDays: 6,
    })
    notify(
      online ? 'Booking confirmed / बुकिंग पक्की हुई' : 'Saved offline, will sync / ऑफ़लाइन सेव',
    )
    navigate(`/receipt/${booking.id}`)
  }

  const listening = phase === LISTENING

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[0.95fr,1.05fr] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-primary">
          <Bilingual en="Voice Booking" hi="बोलकर बुक करें" />
        </h1>
      </div>

      {/* The microphone listens in whichever language is selected here. */}
      <div className="flex gap-2">
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLanguage(l.id)}
            aria-pressed={l.id === lang}
            disabled={listening}
            className={`cc-chip flex-1 !justify-center !py-2.5 text-sm disabled:opacity-60 ${
              l.id === lang ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {l.native}
          </button>
        ))}
      </div>

      <div className="grid place-items-center py-4">
        <div className="relative grid place-items-center">
          {listening && (
            <>
              <span className="absolute h-32 w-32 rounded-full bg-primary/30 animate-pulse-ring" />
              <span
                className="absolute h-32 w-32 rounded-full bg-primary/20 animate-pulse-ring"
                style={{ animationDelay: '0.6s' }}
              />
            </>
          )}
          <button
            type="button"
            onClick={listening ? stop : start}
            disabled={!supported}
            aria-label={listening ? 'Stop listening' : 'Start voice booking'}
            className={`relative grid h-32 w-32 place-items-center rounded-full text-on-primary shadow-lifted transition active:scale-95 disabled:opacity-45 ${
              listening ? 'bg-error' : 'bg-primary hover:bg-primary-container'
            }`}
          >
            {!supported ? (
              <MicOff size={46} strokeWidth={2.5} aria-hidden="true" />
            ) : listening ? (
              <Square size={40} strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Mic size={48} strokeWidth={2.5} aria-hidden="true" />
            )}
          </button>
        </div>

        <p className="mt-5 max-w-[300px] text-center text-sm font-medium text-on-surface-variant">
          {!supported ? (
            'This browser cannot listen. Chrome or Edge can. Use the example below to see the flow.'
          ) : listening ? (
            <Bilingual en="Listening… tap to stop" hi="सुन रहे हैं… रोकने के लिए दबाएँ" />
          ) : phase === PARSED ? (
            <Bilingual en="Got it" hi="समझ गए" />
          ) : (
            <Bilingual en="Tap and speak" hi="दबाकर बोलें" />
          )}
        </p>

        <button
          type="button"
          onClick={runExample}
          className="mt-3 min-h-0 rounded-full px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
        >
          <Bilingual en="Try an example instead" hi="उदाहरण चलाकर देखें" />
        </button>

        {/* The typed door. The microphone needs Chrome, HTTPS and a network;
            a text box needs nothing, and it runs the identical parser - so the
            flow survives any hall, and anyone can verify the parsing is real. */}
        <form
          className="mt-4 flex w-full max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim()) interpret(typed.trim())
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={(EXAMPLES[lang] ?? EXAMPLES.en)[0]}
            aria-label="Type your booking instead"
            className="cc-field !h-12 flex-1 text-sm"
          />
          <button type="submit" className="cc-btn-outline shrink-0 !px-4 !py-2 text-sm">
            <Bilingual en="Parse" hi="समझो" />
          </button>
        </form>
      </div>

      {(heard || listening) && (
        <Card accent="green" className="!bg-surface-container-high p-5">
          <p className="text-center text-lg italic leading-relaxed">
            &ldquo;{heard || '…'}
            {listening && <span className="animate-pulse">|</span>}&rdquo;
          </p>
        </Card>
      )}
      </div>

      <div className="space-y-5">
      {/* On a laptop, everything the app understood lives in this right-hand
          column, beside the microphone rather than below it. */}
      {!parsed && !partial && !error && (
        <Card accent="none" className="hidden p-6 text-center text-sm leading-relaxed text-on-surface-variant lg:block">
          Speak or type a booking - the understood crop, quantity and pickup date appear here for
          confirmation before anything is booked.
        </Card>
      )}

      {partial && phase !== PARSED && (
        <Card accent="blue" className="animate-slide-up p-5">
          <h2 className="text-base font-semibold">
            <Bilingual en="Understood - just need the quantity" hi="समझ गए - बस मात्रा बताएं" />
          </h2>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            {partial.crop?.name} / {partial.crop?.nameHi} · <Bilingual en="pickup" hi="पिकअप" />{' '}
            {partial.dayLabel}
            {partial.day !== 'date' && ` · ${partial.dayDateShort}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[50, 100, 200, 450].map((qty) => (
              <button
                key={qty}
                type="button"
                className="cc-chip bg-surface-container-high !px-4 !py-2.5 text-sm font-semibold hover:bg-primary hover:text-on-primary"
                onClick={() => {
                  const quantity = { count: qty, unit: 'kg', quantityKg: qty, assumedUnit: false }
                  const matches = matchStorages(partial.cropId, qty)
                  const storage = matches.find((m) => m.acceptsLot) ?? matches[0]
                  setParsed({ ...partial, ok: true, quantity, storage })
                  setPartial(null)
                  setPickupChoice(null)
                  setPhase(PARSED)
                }}
              >
                {qty} kg
              </button>
            ))}
          </div>
        </Card>
      )}

      {error && (
        <Card accent="amber" className="p-4">
          <p className="flex items-start gap-2.5 text-base leading-relaxed">
            <AlertTriangle
              size={20}
              strokeWidth={2.5}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-secondary"
            />
            {error}
          </p>
          <p className="mt-3 text-sm text-on-surface-variant">
            Say something like: &ldquo;{(EXAMPLES[lang] ?? EXAMPLES.en)[0]}&rdquo;
          </p>
        </Card>
      )}

      {phase === PARSED && parsed && (
        <div className="animate-slide-up space-y-5">
          <Card accent="blue" className="p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles size={22} strokeWidth={2.5} className="text-tertiary" aria-hidden="true" />
              <Bilingual en="Understood as" hi="ऐसा समझा गया" />
            </h2>

            <dl className="mt-4 divide-y divide-outline-variant/50">
              <Row icon={Tractor} label="Crop" labelHi="फसल">
                {parsed.crop.name} / {parsed.crop.nameHi}
              </Row>
              <Row icon={Weight} label="Quantity" labelHi="मात्रा">
                {parsed.quantity.count} {parsed.quantity.unit}
                {parsed.quantity.count > 1 && parsed.quantity.unit !== 'kg' ? 's' : ''} (
                {kg(parsed.quantity.quantityKg)})
              </Row>
              <Row icon={CalendarDays} label="Pickup" labelHi="पिकअप">
                {pickupChoice?.date
                  ? dateShort(new Date(`${pickupChoice.date}T00:00:00`))
                  : pickupChoice
                    ? `${DAY_LABELS[pickupChoice.dayId][lang] ?? DAY_LABELS[pickupChoice.dayId].en} · ${dateShort(addDays(new Date(), pickupChoice.offset))}`
                    : `${parsed.dayLabel}${parsed.day !== 'date' && parsed.dayDateShort ? ` · ${parsed.dayDateShort}` : ''}`}
              </Row>
              <Row icon={Snowflake} label="Matched storage" labelHi="गोदाम">
                {parsed.storage.name} • {parsed.storage.distanceKm} km •{' '}
                {rupee(parsed.storage.pricePerKgDay, { decimals: 2 })}/kg/day
              </Row>
            </dl>

            {/* Speech names three days; a calendar names the rest. Whatever was
                heard stands until the farmer taps something else. */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-on-surface-variant">
                <Bilingual en="Change pickup day" hi="पिकअप दिन बदलें" />
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {['today', 'tomorrow', 'dayAfter'].map((dayId, offset) => {
                  const active = pickupChoice?.dayId === dayId || (!pickupChoice && parsed.day === dayId)
                  return (
                    <button
                      key={dayId}
                      type="button"
                      onClick={() => setPickupChoice({ dayId, offset })}
                      className={`cc-chip !py-2 text-sm ${
                        active ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {DAY_LABELS[dayId][lang] ?? DAY_LABELS[dayId].en}
                    </button>
                  )
                })}
                <input
                  type="date"
                  aria-label="Pick any date"
                  value={pickupChoice?.date ?? ''}
                  min={new Date().toISOString().slice(0, 10)}
                  max={addDays(new Date(), 60).toISOString().slice(0, 10)}
                  onChange={(e) => e.target.value && setPickupChoice({ date: e.target.value })}
                  className={`cc-chip !py-1.5 text-sm ${
                    pickupChoice?.date ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                />
              </div>
            </div>

            {parsed.quantity.assumedUnit && (
              <Chip tone="amber" className="mt-3">
                Unit not heard - assumed crates
              </Chip>
            )}

            <p className="mt-4 rounded-sm bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
              Estimated 6-day storage cost: {rupee(parsed.storage.estimatedCost)}
            </p>
          </Card>

          <div className="space-y-3">
            <button type="button" className="cc-btn-primary w-full !py-5" onClick={confirm}>
              <Bilingual en="Confirm Booking" hi="बुकिंग पक्की करें" stacked />
            </button>
            <button
              type="button"
              className="cc-btn-outline w-full"
              onClick={() => {
                submitting.current = false
                setPhase(IDLE)
                setParsed(null)
                setPickupChoice(null)
                setHeard('')
              }}
            >
              <Bilingual en="Say it again" hi="दोबारा बोलें" stacked />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, labelHi, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-xs font-medium text-on-surface-variant">
          {label} / {labelHi}
        </dt>
        <dd className="mt-0.5 text-base font-semibold leading-snug">{children}</dd>
      </div>
      <Icon size={22} strokeWidth={2} className="mt-1 shrink-0 text-on-surface-variant" aria-hidden="true" />
    </div>
  )
}
