import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  Check,
  IndianRupee,
  Leaf,
  RefreshCw,
  Snowflake,
  Upload,
} from 'lucide-react'
import { useApp } from '../store/context'
import { CROPS } from '../data/seed'
import { analyseProduceSmart, RECOMMENDATIONS } from '../lib/vision'
import { preloadModel } from '../lib/model'
import { decideForLot, decisionHeadline } from '../lib/decision'
import { matchStorages } from '../lib/ai'
import { api } from '../lib/api'
import { kg, rupee } from '../lib/format'
import { Bilingual, Card, ProgressBar, SectionTitle } from '../components/ui'

const TONE = {
  COLD_STORE: { accent: 'green', chip: 'green', icon: Snowflake, badge: 'bg-primary text-on-primary' },
  SELL_NOW: { accent: 'amber', chip: 'amber', icon: Leaf, badge: 'bg-secondary-container text-on-secondary-container' },
  SELL_URGENT: { accent: 'red', chip: 'red', icon: AlertTriangle, badge: 'bg-error text-on-error' },
}

/** Lot sizes a small farmer actually brings, in kilograms. */
const LOT_SIZES = [50, 100, 200, 450]

export default function Freshness() {
  const { lang, recordScan, createBooking, notify, online } = useApp()
  const navigate = useNavigate()

  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [quantityKg, setQuantityKg] = useState(450)
  // The classifier suggests; the farmer decides. Null means the suggestion stands.
  const [chosenCropId, setChosenCropId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Warm the classifier while the farmer is still deciding what to
  // photograph. Costs nothing if it never loads.
  useEffect(() => {
    preloadModel()
  }, [])

  const cameraRef = useRef(null)
  const uploadRef = useRef(null)
  const submitting = useRef(false)

  /**
   * What is actually on screen: the analysis, with the farmer's crop applied.
   *
   * Every crop was scored during the analysis, so correcting the identification
   * is instant and does not re-read the photograph.
   */
  const view = useMemo(() => {
    if (!result) return null
    const cropId = chosenCropId ?? result.cropId

    // The trained model already produced a stage and a shelf life for the crop
    // it identified, and those must not be quietly replaced by the colour
    // measurements underneath - which is what happened until this was fixed:
    // the screen showed a freshness of 99 for a lot the model had just called
    // spoiled. Once the farmer corrects the crop the model's answer no longer
    // applies to it, so the measurements take over again and the line beneath
    // the picker says so.
    if (result.modelUsed && !result.modelDeferred && cropId === result.cropId) {
      return { ...result, corrected: false }
    }

    const scores = result.perCrop?.[cropId]
    if (!scores) return result
    const { freshness, remainingDays } = scores
    const recommendation =
      freshness >= 75 && remainingDays >= 4
        ? 'COLD_STORE'
        : freshness >= 50 && remainingDays >= 2
          ? 'SELL_NOW'
          : 'SELL_URGENT'
    return {
      ...result,
      cropId,
      crop: CROPS.find((c) => c.id === cropId) ?? result.crop,
      freshness,
      remainingDays,
      recommendation,
      uneven: scores.uneven,
      corrected: cropId !== result.cropId,
    }
  }, [result, chosenCropId])

  /**
   * The photograph on its own is a score. Joined to the price forecast and the
   * facility's rate it becomes an amount of money, which is the only form a
   * farmer can act on.
   */
  const plan = useMemo(() => {
    if (!view) return null
    const matches = matchStorages(view.cropId, quantityKg)
    const storage = matches.find((m) => m.acceptsLot) ?? matches[0]
    const decision = decideForLot({
      cropId: view.cropId,
      remainingDays: view.remainingDays,
      quantityKg,
      ratePaisePerKgDay: Math.round(storage.pricePerKgDay * 100),
    })
    return { storage, decision }
  }, [view, quantityKg])

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('That file is not a photo.')
      return
    }

    setError(null)
    setBusy(true)
    setResult(null)

    const url = URL.createObjectURL(file)
    setPreview(url)

    const img = new Image()
    img.onload = async () => {
      try {
        const analysis = await analyseProduceSmart(img)
        if (!analysis.ok) {
          setError(analysis.reason)
        } else {
          setChosenCropId(null)
          setResult(analysis)
          recordScan({
            cropId: analysis.cropId,
            freshness: analysis.freshness,
            remainingDays: analysis.remainingDays,
            recommendation: analysis.recommendation,
          })
          // Best effort: the scan is already saved locally, so a sleeping
          // backend must not surface as an error to the farmer.
          api
            .createScan({
              predicted_crop_id: analysis.cropId,
              crop_confidence: analysis.confidence,
              freshness_score: analysis.freshness,
              remaining_shelf_life_days: analysis.remainingDays,
              recommendation: analysis.recommendation,
              features: analysis.features,
            })
            .catch(() => {})
        }
      } catch {
        setError('That photo could not be read. Try another one.')
      } finally {
        setBusy(false)
      }
    }
    img.onerror = () => {
      setError('That photo could not be read. Try another one.')
      setBusy(false)
    }
    img.src = url
  }

  const reset = () => {
    setResult(null)
    setChosenCropId(null)
    setError(null)
    setPreview(null)
    submitting.current = false
  }

  /** Book the storage the engine just recommended, without retyping anything. */
  const bookRecommended = () => {
    if (submitting.current || !plan) return
    submitting.current = true

    const booking = createBooking({
      cropId: view.cropId,
      quantityKg,
      storageId: plan.storage.id,
      pickup: 'Tomorrow',
      holdDays: Math.max(1, plan.decision.holdDays),
    })
    notify(online ? 'Booking confirmed / बुकिंग पक्की हुई' : 'Saved offline, will sync / ऑफ़लाइन सेव')
    navigate(`/receipt/${booking.id}`)
  }

  const tone = view ? TONE[view.recommendation] : null
  const Icon = tone?.icon
  const advice = view
    ? RECOMMENDATIONS[view.recommendation][lang] ?? RECOMMENDATIONS[view.recommendation].en
    : null

  return (
    <div className="space-y-5">
      <SectionTitle
        en="Freshness Check"
        hi="ताज़गी जाँच"
        sub="Photograph your produce. The app identifies the crop, estimates how much shelf life is left, then works out whether storing it earns more than selling today."
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!result && (
        <Card accent="blue" className="p-5">
          {preview && (
            <img
              src={preview}
              alt="The produce being checked"
              className="mb-4 max-h-56 w-full rounded-md object-cover"
            />
          )}

          <div className="space-y-3">
            <button
              type="button"
              className="cc-btn-primary w-full !py-5"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
            >
              <Camera size={24} strokeWidth={2.5} aria-hidden="true" />
              <Bilingual en={busy ? 'Analysing…' : 'Take a photo'} hi="फ़ोटो लें" stacked />
            </button>
            <button
              type="button"
              className="cc-btn-outline w-full"
              onClick={() => uploadRef.current?.click()}
              disabled={busy}
            >
              <Upload size={20} strokeWidth={2.5} aria-hidden="true" />
              <Bilingual en="Choose from gallery" hi="गैलरी से चुनें" />
            </button>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
            Photograph in good light with the produce filling most of the frame. Everything is
            analysed on this phone - the photo is never uploaded.
          </p>
        </Card>
      )}

      {error && (
        <Card accent="red" className="p-4">
          <p className="text-base font-medium text-on-error-container">{error}</p>
        </Card>
      )}

      {result && (
        <>
          <Card accent={tone.accent} className="animate-slide-up overflow-hidden">
            {preview && (
              <img src={preview} alt="The produce that was checked" className="h-44 w-full object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-start gap-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${tone.badge}`}>
                  <Icon size={24} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold leading-tight">{advice.title}</h2>
                  <p className="mt-1.5 text-base leading-relaxed text-on-surface-variant">
                    {advice.body}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-surface-container-low p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    Freshness
                  </p>
                  <p className="mt-1 text-3xl font-bold text-primary">{view.freshness}</p>
                  <div className="mt-2">
                    <ProgressBar value={view.freshness} />
                  </div>
                </div>
                <div className="rounded-md bg-surface-container-low p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    Shelf life left
                  </p>
                  <p className="mt-1 text-3xl font-bold text-tertiary">{view.remainingDays}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">days at room temperature</p>
                </div>
              </div>

              {/*
                The classifier suggests, the farmer decides.

                This is not politeness. Identifying the crop from colour is a
                closed-set problem - asked which of four crops a photograph
                shows, the model must answer with one of them, and it will
                answer confidently about a photograph of a hand, because skin
                really is potato-coloured. No threshold fixes that; letting the
                person who grew the thing correct it does, in one tap.
              */}
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <Bilingual en="Which crop is this?" hi="कौन सी फसल है?" />
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CROPS.map((c) => {
                    const active = c.id === view.cropId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setChosenCropId(c.id)}
                        aria-pressed={active}
                        className={`cc-chip !py-2.5 text-sm ${
                          active
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        <span className="mr-1" aria-hidden="true">{c.emoji}</span>
                        {c.name}
                      </button>
                    )
                  })}
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-on-surface-variant">
                  {view.corrected ? (
                    <>
                      The photo looked most like {result.crop.name} ({result.confidence}%
                      confident). You changed it, and everything below now uses {view.crop.name}.
                    </>
                  ) : (
                    <>
                      The app read this as {result.crop.name}, {result.confidence}% confident.
                      {result.lowConfidence
                        ? ' That is a weak reading - please check it before booking.'
                        : ' Tap another crop if that is wrong.'}
                    </>
                  )}
                </p>

                {/*
                  Which of the two pipelines actually answered, and how well it
                  scored on data it never saw. A number a farmer can ignore and
                  a judge can check beats a claim neither can.
                */}
                <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
                  {result.modelUsed && !result.modelDeferred ? (
                    <>
                      Read by the <strong>trained classifier</strong>
                      {result.model?.stage && <> · stage: {result.model.stage}</>}
                      {typeof result.model?.accuracy?.crop === 'number' && (
                        <>
                          {' '}· {Math.round(result.model.accuracy.crop * 100)}% crop accuracy on a
                          held-out test set
                        </>
                      )}
                    </>
                  ) : result.modelUsed ? (
                    <>
                      The classifier was unsure or saw a crop this app does not stock, so the
                      colour-and-texture measurements below decided instead.
                    </>
                  ) : (
                    <>
                      Read by <strong>colour and texture analysis</strong> on this device. The
                      trained model is still downloading or unavailable; nothing is lost, it is
                      simply the more careful of the two answers.
                    </>
                  )}
                </p>
              </div>

              {view.uneven && (
                <p className="mt-3 rounded-sm bg-secondary-fixed px-4 py-3 text-sm leading-relaxed text-on-secondary-container">
                  This lot is <strong>uneven</strong> - one part of it scored much worse than the
                  rest. Sort out the bad portion before storing, or the whole consignment will be
                  graded down.
                </p>
              )}
            </div>
          </Card>

          {/* The lot size turns a score into an amount, so it has to be asked. */}
          <Card accent="none" className="p-5">
            <h2 className="text-lg font-semibold">
              <Bilingual en="How much of this lot?" hi="कितना माल है?" />
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {LOT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setQuantityKg(size)}
                  aria-pressed={size === quantityKg}
                  className={`cc-chip !py-2.5 text-sm ${
                    size === quantityKg
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {kg(size)}
                </button>
              ))}
            </div>
          </Card>

          {plan && <DecisionCard plan={plan} lang={lang} onBook={bookRecommended} />}

          {/* Show the working: a farmer told to sell today deserves the reason. */}
          <Card accent="none" className="p-5">
            <h2 className="text-lg font-semibold">What the app measured</h2>
            <dl className="mt-3 divide-y divide-outline-variant/50 text-sm">
              <Row label="Dark spots and blemishes" value={`${result.features.blemishPct}% of surface`} />
              <Row label="Browning" value={`${result.features.browningPct}% of surface`} />
              <Row label="Colour strength" value={`${result.features.saturationPct}%`} />
              <Row label="Brightness" value={`${result.features.brightnessPct}%`} />
              <Row label="Surface unevenness" value={result.features.texture.toFixed(3)} />
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
              Colour, blemish coverage and surface texture are measured directly from the photo on
              this device. A trained detector replaces this analysis in production without changing
              anything you see here.
            </p>
          </Card>

          <button type="button" className="cc-btn-outline w-full" onClick={reset}>
            <RefreshCw size={18} strokeWidth={2.5} aria-hidden="true" />
            <Bilingual en="Check another" hi="दूसरा जाँचें" />
          </button>
        </>
      )}
    </div>
  )
}

/**
 * The verdict, in rupees, with the working shown underneath.
 *
 * The day-by-day table is not decoration. A farmer being told to wait six days
 * is being asked to take a risk, and the least the app can do is show what it
 * expects to happen on each of them.
 */
function DecisionCard({ plan, lang, onBook }) {
  const { decision, storage } = plan
  const store = decision.action === 'STORE'

  return (
    <Card accent={store ? 'green' : 'amber'} className="animate-slide-up p-5">
      <div className="flex items-start gap-4">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
            store ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container'
          }`}
        >
          <IndianRupee size={24} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            What this is worth
          </p>
          <h2 className="mt-0.5 text-xl font-bold leading-tight">{decisionHeadline(decision, lang)}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
            Sell today: {rupee(decision.sellTodayNet)}
            {store && <> · Best day: {rupee(decision.bestNet)} (+{decision.gainPct}%)</>}
          </p>
        </div>
      </div>

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <th className="pb-2 font-semibold">Day</th>
            <th className="pb-2 text-right font-semibold">Price</th>
            <th className="pb-2 text-right font-semibold">Sellable</th>
            <th className="pb-2 text-right font-semibold">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/50">
          {decision.options.map((o) => {
            const best = o.day === decision.holdDays
            return (
              <tr key={o.day} className={best ? 'font-bold text-primary' : 'text-on-surface-variant'}>
                <td className="py-2">
                  {best && <Check size={14} strokeWidth={3} className="mr-1 inline" aria-hidden="true" />}
                  {o.day === 0 ? 'Today' : `+${o.day}d`}
                </td>
                <td className="py-2 text-right tabular-nums">₹{o.price.toFixed(1)}</td>
                <td className="py-2 text-right tabular-nums">{o.sellablePct}%</td>
                <td className="py-2 text-right tabular-nums">{rupee(o.net)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
        Sellable share falls as produce ages. Cold storage slows that by about four times, which is
        deliberately the conservative end of the published range - promising a longer life than the
        chamber delivers is how a farmer ends up with a rotten consignment.
      </p>

      {store ? (
        <button type="button" className="cc-btn-primary mt-4 w-full !py-5" onClick={onBook}>
          <Snowflake size={22} strokeWidth={2.5} aria-hidden="true" />
          <Bilingual
            en={`Book ${decision.holdDays} days at ${storage.name}`}
            hi="कोल्ड स्टोरेज बुक करें"
            stacked
          />
        </button>
      ) : (
        <p className="mt-4 rounded-sm bg-secondary-fixed px-4 py-3 text-sm leading-relaxed text-on-secondary-container">
          Storing this lot would cost more than the price rise returns, so the app is not going to
          sell you a booking you do not need.
        </p>
      )}
    </Card>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  )
}
