import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Banknote, Lightbulb, Sun } from 'lucide-react'
import { CROPS, CURRENT_LOT, getCrop } from '../data/seed'
import { sellOrStore, spoilage } from '../lib/ai'
import { kg, rupee } from '../lib/format'
import { BarChart, Bilingual, Card, Chip, SectionTitle } from '../components/ui'
import { useApp } from '../store/context'

export default function Advisor() {
  const [cropId, setCropId] = useState(CURRENT_LOT.cropId)
  const navigate = useNavigate()
  const { notify } = useApp()

  const crop = getCrop(cropId)
  const quantityKg = CURRENT_LOT.quantityKg
  const advice = sellOrStore(cropId, quantityKg)
  const decay = spoilage(cropId, 0)

  const max = Math.max(...advice.series)
  const min = Math.min(...advice.series)
  const span = max - min || 1

  const isStore = advice.action === 'STORE'

  return (
    <div className="space-y-6">
      <SectionTitle
        en="Price Predictor"
        hi="मूल्य भविष्यवक्ता"
        sub={`${crop.name} (${crop.nameHi}) • ${CURRENT_LOT.quality}`}
      />

      {/* Switching crops re-runs the model live - cauliflower flips it to SELL. */}
      <div className="cc-scroll-x -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {CROPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCropId(c.id)}
            className={`cc-chip shrink-0 !px-4 !py-2.5 text-sm ${
              c.id === cropId
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <span aria-hidden="true">{c.emoji}</span> {c.name}
          </button>
        ))}
      </div>

      <Card accent="blue" className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">7-Day Price Trend</h2>
            {/*
              This said "based on local mandi data" next to a green Live chip.
              Neither was true: the series is sample data that ships with the
              app, and no price feed is connected. Production reads Agmarknet,
              the government's daily mandi price API, through the same shape.
              Saying so costs nothing and a claim that fails one question costs
              a great deal.
            */}
            <p className="text-sm text-on-surface-variant">
              Sample price series. Production reads daily mandi rates from Agmarknet.
            </p>
          </div>
          <Chip tone="amber">Sample data</Chip>
        </div>

        <BarChart
          heightClass="h-44"
          ariaLabel={`Price forecast for ${crop.name}`}
          items={advice.series.map((price, day) => {
            const isPeak = day === advice.holdDays && isStore
            // Same transform for the bar and its uncertainty whisker.
            const toPct = (v) => 22 + ((v - min) / span) * 78
            const b = advice.band[day]
            return {
              key: day,
              // Floor of 22% so the cheapest day is still a visible column.
              pct: toPct(price),
              range: day === 0 ? null : { low: toPct(b.low), high: toPct(b.high) },
              topLabel: price.toFixed(1),
              topClass: isPeak ? 'text-primary' : 'text-on-surface-variant',
              barClass: isPeak
                ? 'bg-primary'
                : day === 0
                  ? 'bg-surface-container-highest'
                  : 'bg-tertiary-container/70',
            }
          })}
        />
        <div className="mt-2 flex justify-between text-xs font-medium">
          <span className="text-primary">Today</span>
          <span className="text-tertiary">+6 Days</span>
        </div>
        <p className="mt-3 flex items-center gap-2 border-t border-outline-variant/50 pt-3 text-xs text-on-surface-variant">
          <span className="inline-block h-3 w-[3px] shrink-0 rounded-full bg-on-surface/35" aria-hidden="true" />
          Whiskers show the likely range, widening the further out the forecast reaches
          ({advice.dailyVolPct.toFixed(1)}% daily volatility).
        </p>
      </Card>

      <Card accent={isStore ? 'green' : 'amber'} className="p-5">
        <div className="flex gap-4">
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
              isStore ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            <Lightbulb size={24} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">AI Recommendation</h2>
            <p className="mt-1.5 text-base leading-relaxed">
              {isStore ? (
                <>
                  <strong className="text-primary">STORE for {advice.holdDays} days</strong> - expected price{' '}
                  {advice.pctChange >= 0 ? '+' : ''}
                  {advice.pctChange.toFixed(0)}% ({rupee(advice.todayPrice)} →{' '}
                  {rupee(advice.peakPrice, { decimals: 1 })}/kg)
                </>
              ) : (
                <>
                  <strong className="text-secondary">SELL NOW</strong> - prices are falling this week (
                  {rupee(advice.todayPrice)} → {rupee(advice.series[6], { decimals: 1 })}/kg). Storing
                  costs more than it earns.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip icon={BadgeCheck}>Confidence: {advice.confidence}%</Chip>
          {isStore && (
            <Chip tone="green" icon={Banknote}>
              +{rupee(advice.expectedProfit)} expected profit
            </Chip>
          )}
        </div>
      </Card>

      <Card accent="amber" className="p-5 text-center">
        <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-surface-container-high text-5xl" aria-hidden="true">
          {crop.emoji}
        </span>
        <h2 className="mt-4 text-xl font-bold">Your {crop.plural}</h2>
        <p className="text-sm text-on-surface-variant">
          Batch ID: {CURRENT_LOT.batchId} • {kg(quantityKg)}
        </p>

        <div className="mt-4 flex justify-center">
          <Chip tone={decay.urgency === 'ok' ? 'neutral' : 'red'} icon={Sun}>
            Stays fresh for {decay.remaining} days
          </Chip>
        </div>

        {/* The recommended action always takes the primary button. */}
        <div className="mt-5 space-y-3">
          <button
            type="button"
            className={`w-full ${isStore ? 'cc-btn-primary !py-5' : 'cc-btn-outline'}`}
            onClick={() => navigate('/storage')}
          >
            <Bilingual en="Store Now" hi="स्टोर करें" stacked />
          </button>
          <button
            type="button"
            className={`w-full ${isStore ? 'cc-btn-amber' : 'cc-btn-primary !py-5'}`}
            onClick={() => {
              notify('Listed on the buyer marketplace')
              navigate('/marketplace')
            }}
          >
            <Bilingual en="Sell Now" hi="अभी बेचें" stacked />
          </button>
        </div>
      </Card>
    </div>
  )
}
