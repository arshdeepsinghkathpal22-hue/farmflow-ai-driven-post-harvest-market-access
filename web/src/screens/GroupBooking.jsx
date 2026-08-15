import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PiggyBank, User } from 'lucide-react'
import { useApp } from '../store/context'
import { getCrop, getStorage } from '../data/seed'
import { poolMath } from '../lib/ai'
import { kg, rupee } from '../lib/format'
import { Avatar, Bilingual, Card, Chip, ProgressBar, SectionTitle } from '../components/ui'
import RouteMap from '../components/RouteMap'

export default function GroupBooking() {
  const { pool, farmer, hasJoinedPool, joinPool, leavePool, createBooking, notify, online } = useApp()
  const navigate = useNavigate()
  const submitting = useRef(false)

  const math = poolMath(pool, hasJoinedPool)
  const storage = getStorage(pool.storageId)
  const crop = getCrop('tomato')

  // The farmer's own stop only appears on the route once they have joined.
  const stops = [
    ...pool.members.map((m) => ({ ...m, isYou: false })),
    { id: 'you', name: 'You', village: farmer.village, qtyKg: pool.yourLotKg, isYou: true },
  ]

  const confirmPool = () => {
    if (!hasJoinedPool) {
      joinPool(pool.id)
      notify('Joined the pool / पूल में शामिल हो गए')
      return
    }
    // Guards the double-tap: both clicks fire before React re-renders.
    if (submitting.current) return
    submitting.current = true

    const booking = createBooking({
      cropId: crop.id,
      quantityKg: math.yourKg,
      storageId: pool.storageId,
      pickup: pool.pickupLabel,
      pooled: true,
      holdDays: 6,
    })
    notify(online ? 'Pooled booking confirmed / ग्रुप बुकिंग पक्की' : 'Saved offline, will sync / ऑफ़लाइन सेव')
    navigate(`/receipt/${booking.id}`)
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        en="Join Group Booking"
        sub="Pool your produce with nearby farmers to unlock transport discounts."
      />

      <Card accent="green" className="p-4">
        <RouteMap stops={stops} joined={hasJoinedPool} />

        <ol className="mt-3 grid grid-cols-2 gap-2">
          {stops.map((m, i) => (
            <li
              key={m.id}
              className={`flex items-center gap-2 rounded-sm px-3 py-2.5 text-sm ${
                m.isYou
                  ? hasJoinedPool
                    ? 'bg-primary text-on-primary'
                    : 'border-2 border-dashed border-primary/50 bg-surface-container-low'
                  : 'bg-surface-container-low'
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  m.isYou && hasJoinedPool ? 'bg-on-primary text-primary' : 'bg-primary text-on-primary'
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 truncate font-medium">{m.village}</span>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-center justify-between rounded-md bg-surface-container-high px-4 py-3">
          <div>
            <p className="text-xs text-on-surface-variant">Scheduled Pickup</p>
            <p className="text-base font-semibold">{pool.pickupLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-on-surface-variant">Transport Cost</p>
            <p className="text-base font-semibold text-primary">{rupee(pool.transportCostTotal)}</p>
          </div>
        </div>
      </Card>

      <Card accent="blue" className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary-fixed text-on-secondary-container">
            <PiggyBank size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-semibold">
              You save {rupee(math.savings)} on transport
            </p>
            <p className="text-sm text-on-surface-variant">
              Your share is {rupee(math.yourShare)} instead of {rupee(pool.soloTransportCost)} hiring
              alone.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="font-semibold">Capacity: {kg(pool.palletCapacityKg)}</p>
            {math.fullTruck && (
              <span className="text-sm font-semibold text-primary">Full Truck Discount Unlocked!</span>
            )}
          </div>
          <ProgressBar
            value={math.fillPct}
            label="0 kg"
            trailing={`1 Pallet (${kg(pool.palletCapacityKg)})`}
          />
        </div>
      </Card>

      <Card accent="green" className="p-5">
        <h2 className="text-lg font-semibold">Group Members</h2>
        <ul className="mt-3 divide-y divide-outline-variant/50">
          {stops.map((m) => (
            <li
              key={m.id}
              className={`flex items-center gap-3 py-3 ${
                m.isYou ? '-mx-2 rounded-full bg-primary/5 px-2' : ''
              }`}
            >
              {m.isYou ? (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
                  <User size={20} strokeWidth={2.5} aria-hidden="true" />
                </span>
              ) : (
                <Avatar name={m.name} size={40} />
              )}
              <span className={`min-w-0 flex-1 truncate font-medium ${m.isYou ? 'text-primary' : ''}`}>
                {m.isYou ? 'You' : m.name}
                {m.isYou && !hasJoinedPool && (
                  <span className="ml-2 text-xs font-semibold text-on-surface-variant">
                    not joined yet
                  </span>
                )}
              </span>
              <span className={`font-bold ${m.isYou ? 'text-primary' : ''}`}>{kg(m.qtyKg)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip tone="blue">Destination: {storage.name}</Chip>
          <Chip tone="green">
            {math.memberCount} farmer{math.memberCount > 1 ? 's' : ''} pooled · {kg(math.totalKg)}
          </Chip>
        </div>
      </Card>

      <div className="space-y-3">
        <button type="button" className="cc-btn-primary w-full !py-5" onClick={confirmPool}>
          <Bilingual
            en={hasJoinedPool ? 'Confirm Pooled Booking' : 'Join This Group'}
            hi={hasJoinedPool ? 'बुकिंग पक्की करें' : 'इस ग्रुप में जुड़ें'}
            stacked
          />
        </button>
        {hasJoinedPool && (
          <button
            type="button"
            className="cc-btn-outline w-full"
            onClick={() => {
              leavePool(pool.id)
              notify('Left the pool / पूल छोड़ दिया')
            }}
          >
            <Bilingual en="Leave Pool" hi="पूल छोड़ें" />
          </button>
        )}
      </div>
    </div>
  )
}
