import { useState } from 'react'
import { AlarmClock, Check, MapPin, ShoppingCart, Sun, Weight } from 'lucide-react'
import { BUYER_CATEGORIES, MARKETPLACE_LOTS, getCrop } from '../data/seed'
import { kg, rupee } from '../lib/format'
import { Bilingual, Card, Chip, ImageTile, SectionTitle } from '../components/ui'
import { useApp } from '../store/context'

export default function Marketplace() {
  const [category, setCategory] = useState('All')
  const { purchases, buyLot, notify } = useApp()

  const priority = MARKETPLACE_LOTS.filter((l) => l.priority)
  const listed = MARKETPLACE_LOTS.filter(
    (l) => category === 'All' || l.category === category,
  )

  const buy = (lot) => {
    buyLot(lot.id)
    notify(`Order placed for ${lot.name} / ऑर्डर हो गया`)
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        en="Buyer Marketplace"
        hi="क्रेता बाज़ार"
        sub="Procure fresh produce directly from verified cold storage facilities."
      />

      {/* Spoilage-risk lots surface first: the model turns waste into a discount. */}
      <section>
        <h2 className="mb-3 text-lg font-bold">
          <Bilingual en="Priority Deals" hi="प्राथमिकता सौदे" />
        </h2>
        <div className="cc-scroll-x -mx-5 flex gap-4 overflow-x-auto px-5 pb-2">
          {priority.map((lot) => {
            const bought = purchases.includes(lot.id)
            return (
              <Card key={lot.id} accent="red" className="w-[78%] shrink-0 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold leading-tight">
                    {lot.name} <span className="font-semibold">/ {lot.nameHi}</span>
                  </h3>
                  <Chip tone="red" icon={AlarmClock} className="shrink-0 !text-[11px]">
                    {lot.freshnessDays} Day{lot.freshnessDays > 1 ? 's' : ''} Left
                  </Chip>
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Qty: {kg(lot.qtyKg)} • {lot.storage}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    {lot.originalPrice && (
                      <p className="text-sm text-on-surface-variant line-through">
                        {rupee(lot.originalPrice)}/kg
                      </p>
                    )}
                    <p className="text-2xl font-bold text-primary">{rupee(lot.pricePerKg)}/kg</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => buy(lot)}
                    disabled={bought}
                    className={`${bought ? 'cc-btn-outline' : 'cc-btn-primary'} shrink-0 !px-5`}
                  >
                    {bought ? (
                      <>
                        <Check size={18} strokeWidth={3} aria-hidden="true" /> Ordered
                      </>
                    ) : (
                      'Buy Now'
                    )}
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <div className="cc-scroll-x -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {BUYER_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`cc-chip shrink-0 !px-5 !py-2.5 text-sm ${
              category === c
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {c === 'All' ? <Bilingual en="All" hi="सभी" /> : c}
          </button>
        ))}
      </div>

      {listed.length === 0 ? (
        <Card className="p-8 text-center text-on-surface-variant">
          No lots listed in this category yet.
        </Card>
      ) : (
        <ul className="space-y-5">
          {listed.map((lot) => {
            const crop = getCrop(lot.cropId)
            const bought = purchases.includes(lot.id)
            const urgent = lot.freshnessDays <= 4
            return (
              <li key={lot.id}>
                <Card accent="green" className="overflow-hidden">
                  <ImageTile gradient={crop.tint} glyph={crop.emoji} height={150}>
                    <span className="absolute left-3 top-3 rounded-full bg-surface-container-lowest/90 px-3 py-1.5 text-xs font-bold shadow-card">
                      Direct from Farmer
                    </span>
                  </ImageTile>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-bold leading-tight">
                        {lot.name} <span className="font-semibold">/ {lot.nameHi}</span>
                      </h3>
                      <p className="shrink-0 text-xl font-bold text-primary">
                        {rupee(lot.pricePerKg)}/kg
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant">
                      <span className="flex items-center gap-1.5">
                        <Weight size={16} strokeWidth={2.5} aria-hidden="true" /> {kg(lot.qtyKg)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={16} strokeWidth={2.5} aria-hidden="true" /> {lot.storage}
                      </span>
                    </div>

                    <p
                      className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${
                        urgent ? 'text-secondary' : 'text-on-surface-variant'
                      }`}
                    >
                      <Sun size={16} strokeWidth={2.5} aria-hidden="true" />
                      Freshness: {lot.freshnessDays} days left
                    </p>

                    <p className="mt-1 text-sm text-on-surface-variant">Farmer: {lot.farmer}</p>

                    <button
                      type="button"
                      onClick={() => buy(lot)}
                      disabled={bought}
                      className={`mt-4 w-full ${bought ? 'cc-btn-outline' : 'cc-btn-primary'}`}
                    >
                      {bought ? (
                        <>
                          <Check size={20} strokeWidth={3} aria-hidden="true" />
                          <Bilingual en="Order Placed" hi="ऑर्डर हुआ" />
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={20} strokeWidth={2.5} aria-hidden="true" />
                          <Bilingual en="Buy Direct" hi="सीधे किसान से खरीदें" />
                        </>
                      )}
                    </button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
