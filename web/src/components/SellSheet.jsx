import { useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { PRICE_SERIES, getCrop } from '../data/seed'
import { kg, rupee } from '../lib/format'
import { Bilingual, Card } from './ui'

/**
 * "Sell now" was a button that navigated somewhere and asked nothing - which
 * meant the one number a sale actually needs, how many kilograms, was never
 * asked. This sheet asks it, prices it at today's mandi rate for the crop, and
 * only then confirms.
 */
const STEP = 25

export default function SellSheet({ cropId, maxKg = 450, onConfirm, onClose }) {
  const crop = getCrop(cropId)
  const pricePerKg = (PRICE_SERIES[cropId] ?? PRICE_SERIES.tomato)[0]
  const [sellKg, setSellKg] = useState(Math.min(maxKg, 450))

  const clamp = (v) => Math.max(STEP, Math.min(maxKg, v))
  const payout = Math.round(sellKg * pricePerKg)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Sell produce"
      onClick={onClose}
    >
      <Card
        accent="amber"
        className="w-full max-w-md animate-slide-up rounded-b-none p-5 sm:rounded-b-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold leading-tight">
            <Bilingual en={`Sell ${crop.name}`} hi={`${crop.nameHi} बेचें`} />
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-surface-container-high">
            <X size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-1 text-sm text-on-surface-variant">
          <Bilingual en="How much are you selling?" hi="कितना बेचना है?" /> · today {rupee(pricePerKg)}/kg
        </p>

        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            className="grid h-12 w-12 place-items-center rounded-full bg-surface-container-high active:scale-95"
            aria-label={`Less, in steps of ${STEP} kg`}
            onClick={() => setSellKg((v) => clamp(v - STEP))}
          >
            <Minus size={22} strokeWidth={2.8} aria-hidden="true" />
          </button>
          <div className="min-w-[120px] text-center">
            <p className="text-3xl font-bold text-primary">{kg(sellKg)}</p>
            <p className="text-xs text-on-surface-variant">of {kg(maxKg)} in the lot</p>
          </div>
          <button
            type="button"
            className="grid h-12 w-12 place-items-center rounded-full bg-surface-container-high active:scale-95"
            aria-label={`More, in steps of ${STEP} kg`}
            onClick={() => setSellKg((v) => clamp(v + STEP))}
          >
            <Plus size={22} strokeWidth={2.8} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-5 rounded-sm bg-primary/5 px-4 py-3 text-center text-base font-semibold text-primary">
          <Bilingual en={`You receive about ${rupee(payout)}`} hi={`लगभग ${rupee(payout)} मिलेंगे`} />
        </p>

        <button
          type="button"
          className="cc-btn-primary mt-4 w-full !py-5"
          onClick={() => onConfirm({ cropId, kg: sellKg, pricePerKg, payout })}
        >
          <Bilingual en="Confirm sale" hi="बिक्री पक्की करें" stacked />
        </button>
      </Card>
    </div>
  )
}
