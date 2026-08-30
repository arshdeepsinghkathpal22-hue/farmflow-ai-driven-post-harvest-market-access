import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CheckCircle2, IndianRupee, Info, MapPin, Snowflake, Thermometer } from 'lucide-react'
import { CURRENT_LOT, getCrop } from '../data/seed'
import { matchStorages } from '../lib/ai'
import { kg, rupee, tempLabel } from '../lib/format'
import { Bilingual, Card, Chip, ImageTile, SectionTitle } from '../components/ui'
import ClusterMap from '../components/ClusterMap'
import { FARM_POINT, STORAGES } from '../data/seed'
import { useApp } from '../store/context'

const SORTS = [
  { id: 'match', label: 'Best Match', icon: BadgeCheck },
  { id: 'distance', label: 'Distance', icon: MapPin },
  { id: 'price', label: 'Price', icon: IndianRupee },
  { id: 'temp', label: 'Temperature', icon: Thermometer },
]

const LOT_CHOICES = [50, 100, 120, 200, 450]

export default function FindStorage() {
  const [sort, setSort] = useState('match')
  const [mapPick, setMapPick] = useState(null)
  const [quantityKg, setQuantityKg] = useState(120)
  const navigate = useNavigate()
  const submitting = useRef(false)
  const { createBooking, notify, online } = useApp()

  const crop = getCrop(CURRENT_LOT.cropId)

  const results = useMemo(() => {
    const list = matchStorages(crop.id, quantityKg)
    const sorted = [...list]
    if (sort === 'distance') sorted.sort((a, b) => a.distanceKm - b.distanceKm)
    if (sort === 'price') sorted.sort((a, b) => a.pricePerKgDay - b.pricePerKgDay)
    if (sort === 'temp') sorted.sort((a, b) => a.tempGap - b.tempGap)
    return sorted
  }, [crop.id, sort, quantityKg])

  const topScore = Math.max(...results.map((r) => r.score))

  const book = (storage) => {
    if (!storage.acceptsLot) {
      notify('This facility takes bulk lots only', 'error')
      return
    }
    // Set only past validation, so a refused facility never blocks the next try.
    if (submitting.current) return
    submitting.current = true

    const booking = createBooking({
      cropId: crop.id,
      quantityKg,
      storageId: storage.id,
      pickup: 'Tomorrow',
      pickupOffset: 1,
      pickupDayId: 'tomorrow',
      holdDays: 6,
    })
    notify(online ? 'Slot booked / स्लॉट बुक हुआ' : 'Saved offline, will sync / ऑफ़लाइन सेव')
    navigate(`/receipt/${booking.id}`)
  }

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[0.9fr,1.1fr] lg:items-start lg:gap-6 lg:space-y-0">
      {/* Laptop: the map and lot-size choice stay pinned on the left while the
          results scroll on the right. Phone: the same pieces, stacked. */}
      <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
      {/* Where the facilities actually are, relative to the farm. Tapping a
          pin highlights and scrolls to that facility's card below. */}
      <ClusterMap
        title="Cold storages near you"
        storages={STORAGES}
        farm={FARM_POINT}
        highlightId={mapPick}
        onSelectStorage={(id) => {
          setMapPick(id)
          document.getElementById(`storage-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
      />

      {/* How much is being stored decides which facilities fit and what they
          cost - so it is chosen here, not assumed. */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          <Bilingual en="Your lot size" hi="आपका लॉट" />
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LOT_CHOICES.map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => setQuantityKg(qty)}
              className={`cc-chip !px-4 !py-2.5 text-sm font-semibold ${
                quantityKg === qty ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {qty} kg
            </button>
          ))}
        </div>
      </div>
      </div>

      <div className="space-y-5">
      <SectionTitle
        en="Search Results"
        sub={`Cold storage near you for ${kg(quantityKg)} of ${crop.name.toLowerCase()}.`}
      />

      <div className="cc-scroll-x -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {SORTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSort(id)}
            className={`cc-chip shrink-0 !px-4 !py-2.5 text-sm ${
              sort === id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-5">
        {results.map((storage) => {
          const isBest = storage.score === topScore
          return (
            <li key={storage.id} id={`storage-${storage.id}`} className={mapPick === storage.id ? 'rounded-md ring-2 ring-primary' : ''}>
              <Card accent={storage.acceptsLot ? 'blue' : 'amber'} className="overflow-hidden">
                <ImageTile gradient={storage.gradient} glyph="🏬" height={132}>
                  {isBest && (
                    <span className="absolute left-3 top-3 rounded-full bg-secondary-container px-3 py-1.5 text-xs font-bold text-on-secondary-container shadow-card">
                      ★ <Bilingual en="Best Match" hi="सबसे अच्छा" />
                    </span>
                  )}
                  <div className="relative w-full bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-8 text-white">
                    <h3 className="text-lg font-bold leading-tight">{storage.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-sm">
                      <MapPin size={14} strokeWidth={2.5} aria-hidden="true" />
                      {storage.distanceKm} km away
                    </p>
                  </div>
                </ImageTile>

                <div className="p-4">
                  <div className="flex items-center justify-between gap-3 rounded-md bg-surface-container-low px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tertiary-container text-on-tertiary">
                        <Snowflake size={20} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-semibold leading-tight">{tempLabel(storage.tempRange)}</p>
                        <p className="text-xs text-on-surface-variant">{storage.tempLabel}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        {rupee(storage.pricePerKgDay, { decimals: 2 })}
                      </p>
                      <p className="text-xs text-on-surface-variant">per kg/day</p>
                    </div>
                  </div>

                  <p className="mt-3 flex items-center gap-2 text-sm font-medium">
                    {storage.acceptsLot ? (
                      <>
                        <CheckCircle2 size={18} strokeWidth={2.5} className="text-primary" aria-hidden="true" />
                        <span className="text-primary">
                          Micro-slots available · {storage.slotsFree} free
                        </span>
                      </>
                    ) : (
                      <>
                        <Info size={18} strokeWidth={2.5} className="text-on-surface-variant" aria-hidden="true" />
                        <span className="text-on-surface-variant">
                          Bulk slots only - pool with neighbours to qualify
                        </span>
                      </>
                    )}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip tone="neutral">6-day cost ≈ {rupee(storage.estimatedCost)}</Chip>

                  </div>

                  <button
                    type="button"
                    onClick={() => book(storage)}
                    className={`mt-4 w-full ${storage.acceptsLot ? 'cc-btn-primary' : 'cc-btn-outline'}`}
                  >
                    <Bilingual en="Book Slot" hi="स्लॉट बुक करें" />
                    <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      </div>
    </div>
  )
}
