import { useMemo, useState } from 'react'
import { AlarmClock, Check, MapPin, Minus, Plus, ShoppingCart, Sun, Tag, Weight, X } from 'lucide-react'
import { BUYER_CATEGORIES, MARKETPLACE_LOTS, getCrop } from '../data/seed'
import { shelfTone } from '../lib/ai'
import { kg, rupee } from '../lib/format'
import { Bilingual, Card, Chip, ImageTile, SectionTitle } from '../components/ui'
import { useApp } from '../store/context'

/**
 * The buyer marketplace, with an actual cart.
 *
 * "Buy" used to place an order for the whole lot in one tap with no quantity
 * and no basket - fine for a screenshot, wrong the moment somebody actually
 * used it. Now every lot has a kilogram stepper, the cart collects across
 * lots, and checkout shows the total before anything is committed.
 *
 * The farmer's own listings (made through "Sell now") appear at the top, which
 * closes the loop: what one screen sells, this screen shows for sale.
 */
const STEP = 25

function KgStepper({ value, min = STEP, max, onChange }) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={`Less, steps of ${STEP} kg`}
        className="grid h-9 w-9 place-items-center rounded-full bg-surface-container-high active:scale-95"
        onClick={() => onChange(Math.max(min, value - STEP))}
      >
        <Minus size={16} strokeWidth={2.8} aria-hidden="true" />
      </button>
      <span className="min-w-[64px] text-center text-sm font-bold">{kg(value)}</span>
      <button
        type="button"
        aria-label={`More, steps of ${STEP} kg`}
        className="grid h-9 w-9 place-items-center rounded-full bg-surface-container-high active:scale-95"
        onClick={() => onChange(Math.min(max, value + STEP))}
      >
        <Plus size={16} strokeWidth={2.8} aria-hidden="true" />
      </button>
    </span>
  )
}

export default function Marketplace() {
  const [category, setCategory] = useState('All')
  const [cartOpen, setCartOpen] = useState(false)
  // Per-lot quantity the stepper is showing before it goes in the cart.
  const [chosenKg, setChosenKg] = useState({})
  const { cart, sales, purchases, addToCart, setCartKg, checkoutCart, notify } = useApp()

  const priority = MARKETPLACE_LOTS.filter((l) => l.priority)
  const listed = MARKETPLACE_LOTS.filter((l) => category === 'All' || l.category === category)

  const cartDetail = useMemo(
    () =>
      cart
        .map((item) => {
          const lot = MARKETPLACE_LOTS.find((l) => l.id === item.lotId)
          return lot ? { ...item, lot, total: item.kg * lot.pricePerKg } : null
        })
        .filter(Boolean),
    [cart],
  )
  const cartTotal = cartDetail.reduce((sum, i) => sum + i.total, 0)
  const cartKgTotal = cartDetail.reduce((sum, i) => sum + i.kg, 0)

  const kgFor = (lot) => chosenKg[lot.id] ?? Math.min(lot.qtyKg, 100)
  const inCart = (lotId) => cart.some((c) => c.lotId === lotId)

  const add = (lot) => {
    addToCart(lot.id, kgFor(lot))
    notify(`${kg(kgFor(lot))} in cart / कार्ट में`)
  }

  const checkout = () => {
    const order = checkoutCart(
      cartDetail.map(({ lotId, kg: qty, lot, total }) => ({ lotId, kg: qty, name: lot.name, total })),
      cartTotal,
    )
    setCartOpen(false)
    notify(`Order ${order.id} placed · ${rupee(cartTotal)} / ऑर्डर हो गया`)
  }

  const shelfText = { red: 'text-error', amber: 'text-secondary', green: 'text-primary' }

  return (
    <div className="space-y-5 pb-24">
      <SectionTitle
        en="Buyer Marketplace"
        hi="क्रेता बाज़ार"
        sub="Procure fresh produce directly from verified cold storage facilities."
      />

      {/* What the farmer has put up for sale through "Sell now". */}
      {sales.length > 0 && (
        <Card accent="amber" className="p-4">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Tag size={18} strokeWidth={2.5} aria-hidden="true" />
            <Bilingual en="Your lots for sale" hi="आपके बिक्री लॉट" />
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {sales.slice(0, 4).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span>
                  {getCrop(s.cropId).emoji} {getCrop(s.cropId).name} · {kg(s.kg)}
                </span>
                <span className="font-semibold text-primary">
                  {rupee(s.pricePerKg)}/kg · {rupee(s.kg * s.pricePerKg)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Spoilage-risk lots surface first: the model turns waste into a discount. */}
      <section>
        <h2 className="mb-3 text-lg font-bold">
          <Bilingual en="Priority Deals" hi="प्राथमिकता सौदे" />
        </h2>
        <div className="cc-scroll-x -mx-5 flex gap-4 overflow-x-auto px-5 pb-2">
          {priority.map((lot) => (
            <Card key={lot.id} accent="red" className="w-[78%] shrink-0 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold leading-tight">
                  {lot.name} <span className="font-semibold">/ {lot.nameHi}</span>
                </h3>
                <Chip tone={shelfTone(lot.freshnessDays)} icon={AlarmClock} className="shrink-0 !text-[11px]">
                  {lot.freshnessDays} Day{lot.freshnessDays > 1 ? 's' : ''} Left
                </Chip>
              </div>
              <p className="mt-1 text-sm text-on-surface-variant">
                Qty: {kg(lot.qtyKg)} • {lot.storage}
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  {lot.originalPrice && (
                    <p className="text-sm text-on-surface-variant line-through">{rupee(lot.originalPrice)}/kg</p>
                  )}
                  <p className="text-2xl font-bold text-primary">{rupee(lot.pricePerKg)}/kg</p>
                </div>
                <KgStepper value={kgFor(lot)} max={lot.qtyKg} onChange={(v) => setChosenKg((p) => ({ ...p, [lot.id]: v }))} />
              </div>
              <button
                type="button"
                onClick={() => add(lot)}
                className={`mt-3 w-full ${inCart(lot.id) || purchases.includes(lot.id) ? 'cc-btn-outline' : 'cc-btn-primary'}`}
              >
                <ShoppingCart size={18} strokeWidth={2.5} aria-hidden="true" />
                {inCart(lot.id) ? 'Add more' : purchases.includes(lot.id) ? 'Ordered - buy again' : 'Add to cart'}
              </button>
            </Card>
          ))}
        </div>
      </section>

      <div className="cc-scroll-x -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {BUYER_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`cc-chip shrink-0 !px-5 !py-2.5 text-sm ${
              category === c ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {c === 'All' ? <Bilingual en="All" hi="सभी" /> : c}
          </button>
        ))}
      </div>

      {listed.length === 0 ? (
        <Card className="p-8 text-center text-on-surface-variant">No lots listed in this category yet.</Card>
      ) : (
        <ul className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0 xl:grid-cols-3">
          {listed.map((lot) => {
            const crop = getCrop(lot.cropId)
            const tone = shelfTone(lot.freshnessDays)
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
                      <p className="shrink-0 text-xl font-bold text-primary">{rupee(lot.pricePerKg)}/kg</p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant">
                      <span className="flex items-center gap-1.5">
                        <Weight size={16} strokeWidth={2.5} aria-hidden="true" /> {kg(lot.qtyKg)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={16} strokeWidth={2.5} aria-hidden="true" /> {lot.storage}
                      </span>
                    </div>

                    {/* One shelf-life rule everywhere: <=2 days red, <=4 orange, above green. */}
                    <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${shelfText[tone]}`}>
                      <Sun size={16} strokeWidth={2.5} aria-hidden="true" />
                      Freshness: {lot.freshnessDays} days left
                    </p>

                    <p className="mt-1 text-sm text-on-surface-variant">Farmer: {lot.farmer}</p>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <KgStepper value={kgFor(lot)} max={lot.qtyKg} onChange={(v) => setChosenKg((p) => ({ ...p, [lot.id]: v }))} />
                      <p className="text-sm font-bold">{rupee(kgFor(lot) * lot.pricePerKg)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => add(lot)}
                      className={`mt-3 w-full ${inCart(lot.id) || purchases.includes(lot.id) ? 'cc-btn-outline' : 'cc-btn-primary'}`}
                    >
                      {inCart(lot.id) ? (
                        <>
                          <Check size={20} strokeWidth={3} aria-hidden="true" /> In cart - add more
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={20} strokeWidth={2.5} aria-hidden="true" />
                          <Bilingual en="Add to cart" hi="कार्ट में डालें" />
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

      {/* The cart bar. Fixed above the tab bar; opens the basket. */}
      {cartDetail.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-md px-5 lg:bottom-6">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="cc-btn-primary w-full !justify-between !py-4 shadow-lifted"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={20} strokeWidth={2.5} aria-hidden="true" />
              {cartDetail.length} lot{cartDetail.length > 1 ? 's' : ''} · {kg(cartKgTotal)}
            </span>
            <span>{rupee(cartTotal)} →</span>
          </button>
        </div>
      )}

      {/* The basket itself. */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Your cart"
          onClick={() => setCartOpen(false)}
        >
          <Card accent="green" className="w-full max-w-md animate-slide-up rounded-b-none p-5 sm:rounded-b-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">
                <Bilingual en="Your cart" hi="आपका कार्ट" />
              </h2>
              <button type="button" onClick={() => setCartOpen(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-surface-container-high">
                <X size={20} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            <ul className="mt-4 space-y-4">
              {cartDetail.map(({ lotId, kg: qty, lot, total }) => (
                <li key={lotId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lot.name}</p>
                    <p className="text-xs text-on-surface-variant">{rupee(lot.pricePerKg)}/kg</p>
                  </div>
                  <KgStepper value={qty} min={0} max={lot.qtyKg} onChange={(v) => setCartKg(lotId, v)} />
                  <p className="w-20 text-right text-sm font-bold">{rupee(total)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-center justify-between border-t border-outline-variant/50 pt-4">
              <p className="text-base font-bold">
                <Bilingual en="Total" hi="कुल" />
              </p>
              <p className="text-xl font-bold text-primary">{rupee(cartTotal)}</p>
            </div>

            <button type="button" className="cc-btn-primary mt-4 w-full !py-5" onClick={checkout}>
              <Bilingual en={`Place order · ${rupee(cartTotal)}`} hi="ऑर्डर करें" stacked />
            </button>
            <p className="mt-3 text-center text-xs text-on-surface-variant">
              Payment on delivery in this prototype - UPI collection is designed, not built.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
