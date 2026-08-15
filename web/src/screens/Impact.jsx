import { Leaf, TrendingUp, Users, Wind } from 'lucide-react'
import { IMPACT } from '../data/seed'
import { kg, rupeeCompact } from '../lib/format'
import { BarChart, Card, SectionTitle, StatTile } from '../components/ui'

export default function Impact() {
  const max = Math.max(...IMPACT.monthly.map((m) => m.savedKg))

  return (
    <div className="space-y-5">
      <SectionTitle
        en="Cluster Impact"
        hi="हमारा असर"
        sub="A modelled projection for a 148-farmer cluster in Rampur. These are not measured results - no pilot has run yet - and the working is shown at the bottom of this screen."
      />

      <div className="space-y-4">
        <StatTile
          label="Food saved"
          labelHi="बचा हुआ अनाज"
          value={kg(IMPACT.foodSavedKg)}
          sub="Projected - produce that would otherwise have spoiled"
          icon={Leaf}
          tone="green"
        />
        <StatTile
          label="CO₂ avoided"
          labelHi="कार्बन बचत"
          value={`${IMPACT.co2AvoidedTonnes} t`}
          sub="From waste, transport pooling and re-harvest avoided"
          icon={Wind}
          tone="blue"
        />
        <StatTile
          label="Extra farmer income"
          labelHi="अतिरिक्त आय"
          value={rupeeCompact(IMPACT.extraIncome)}
          sub={`Across ${IMPACT.farmersOnboarded} onboarded farmers`}
          icon={TrendingUp}
          tone="amber"
        />
      </div>

      <Card accent="green" className="p-5">
        <h2 className="text-lg font-semibold">Monthly food saved</h2>
        <p className="text-sm text-on-surface-variant">Kilograms rescued per month</p>

        <BarChart
          heightClass="h-40"
          gapClass="gap-2.5"
          ariaLabel="Monthly food saved trend"
          items={IMPACT.monthly.map((m) => ({
            key: m.month,
            pct: (m.savedKg / max) * 100,
            topLabel: m.savedKg,
            bottomLabel: m.month,
            barClass: 'bg-gradient-to-t from-primary to-primary-container',
          }))}
        />
      </Card>

      <Card accent="blue" className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-tertiary-fixed text-tertiary">
            <Users size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="text-base leading-relaxed text-on-surface-variant">
            Every kilogram stored instead of distress-sold keeps roughly{' '}
            <strong className="text-on-surface">₹4-6 of margin</strong> with the farmer rather than
            the trader, and avoids the water and electricity already spent growing it.
          </p>
        </div>
      </Card>

      {/*
        A projection nobody can check is worth nothing, and an unsourced number
        is the fastest way to lose an audience that knows the sector. So the
        assumptions are on the screen, they reconcile with each other, and the
        figures are labelled as modelled rather than observed.
      */}
      <Card accent="none" className="p-5">
        <h2 className="text-lg font-semibold">Where these numbers come from</h2>
        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
          Six months, 148 farmers, roughly 450 kg stored per farmer - about 66,600 kg through the
          cluster.
        </p>

        <dl className="mt-4 divide-y divide-outline-variant/50 text-sm">
          <Assumption
            label="Food saved"
            value="12,400 kg"
            how="Produce that would otherwise have been distress-sold or spoiled - 19% of throughput, the share small lots lose when there is nowhere to keep them."
          />
          <Assumption
            label="Extra income"
            value="₹4.6 L"
            how="₹2.2 L from produce not lost (12,400 kg at about ₹18/kg) plus ₹2.3 L from selling on a better day (66,600 kg at about ₹3.5/kg)."
          />
          <Assumption
            label="CO₂ avoided"
            value="8.2 t"
            how="6.8 t from vegetable matter not decomposing (12,400 kg at about 0.55 kg CO₂e/kg) plus roughly 1.4 t from pooled transport replacing separate vehicle trips."
          />
        </dl>

        <p className="mt-4 rounded-sm bg-surface-container-low px-4 py-3 text-xs leading-relaxed text-on-surface-variant">
          <strong className="text-on-surface">Be clear about this:</strong> these are projections
          from stated assumptions, not field results. Post-harvest loss rates vary widely by crop,
          season and district, and the honest version of this screen after a pilot would replace
          every figure above with something measured.
        </p>
      </Card>
    </div>
  )
}

/** One modelled figure, with the arithmetic that produced it. */
function Assumption({ label, value, how }) {
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-semibold">{label}</dt>
        <dd className="shrink-0 font-bold text-primary">{value}</dd>
      </div>
      <p className="mt-1 leading-relaxed text-on-surface-variant">{how}</p>
    </div>
  )
}
