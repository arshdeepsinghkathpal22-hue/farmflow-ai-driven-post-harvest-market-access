import { Link, useNavigate } from 'react-router-dom'
import { Camera, ChevronRight, LineChart, Mic, Package, Snowflake, Sprout, Truck, Warehouse } from 'lucide-react'
import { useApp } from '../store/context'
import { CURRENT_LOT, STORAGES, getCrop, getStorage } from '../data/seed'
import { poolMath, sellOrStore, spoilage } from '../lib/ai'
import { kg, rupee } from '../lib/format'
import { Avatar, Bilingual, Card, Chip } from '../components/ui'

export default function Home() {
  const { farmer, pool, hasJoinedPool, activeBookings, joinPool, notify } = useApp()
  const navigate = useNavigate()

  const math = poolMath(pool, hasJoinedPool)

  // The info row is derived, not asserted: the lot from its harvest date, the
  // storage from the seeded facility list, the price from the sample series
  // the Prices screen charts (and labels).
  const lotCrop = getCrop(CURRENT_LOT.cropId)
  const lotDecay = spoilage(CURRENT_LOT.cropId, CURRENT_LOT.harvestedDaysAgo)
  const nearest = [...STORAGES]
    .filter((st) => st.slotsFree > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0]
  const todayPrice = sellOrStore(CURRENT_LOT.cropId, CURRENT_LOT.quantityKg).todayPrice

  const handleJoin = () => {
    joinPool(pool.id)
    notify('Joined the pool / पूल में शामिल हो गए')
    navigate('/group')
  }

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[0.95fr,1.05fr] lg:items-start lg:gap-x-8 lg:gap-y-6 lg:space-y-0">
      {/* A greeting anchors the page; both columns hang from it. */}
      <header className="hidden lg:col-span-2 lg:block">
        <h1 className="text-2xl font-bold tracking-tight">
          नमस्ते, {farmer.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-base text-on-surface-variant">
          What would you like to do today? / आज क्या करेंगे?
        </p>
      </header>

      {/* The three things a farmer actually comes here to do, none of them
          buried: speak a booking, photograph a lot, book storage. */}
      <div className="space-y-6 lg:space-y-4">
        <Link
          to="/voice"
          role="button"
          className="cc-btn-primary mx-auto w-full max-w-[420px] !py-5 text-base shadow-lifted lg:max-w-none lg:!py-7 lg:text-lg"
        >
          <Mic size={26} strokeWidth={2.5} aria-hidden="true" />
          <Bilingual en="Speak to Book" hi="बोलकर बुक करें" stacked />
        </Link>

        <div className="mx-auto grid w-full max-w-[420px] grid-cols-2 gap-3 lg:max-w-none lg:gap-4">
          <Link
            to="/freshness"
            role="button"
            className="flex flex-col items-center gap-2.5 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-5 text-center shadow-card transition hover:border-primary/40 hover:bg-primary/5 lg:p-6"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-fixed/60 text-primary">
              <Camera size={24} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="font-semibold leading-tight">
              Check Freshness
              <span className="block text-sm font-medium text-on-surface-variant">ताज़गी जाँच</span>
            </span>
          </Link>
          <Link
            to="/storage"
            role="button"
            className="flex flex-col items-center gap-2.5 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-5 text-center shadow-card transition hover:border-primary/40 hover:bg-primary/5 lg:p-6"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-fixed/60 text-primary">
              <Warehouse size={24} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="font-semibold leading-tight">
              Store Now
              <span className="block text-sm font-medium text-on-surface-variant">स्टोर करें</span>
            </span>
          </Link>
        </div>
      </div>

      <div className="space-y-6 lg:space-y-5">
      {activeBookings.length > 0 && (
        <Card accent="green" className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-fixed/60 text-primary">
              <Package size={22} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {activeBookings.length} active booking
                {activeBookings.length > 1 ? 's' : ''}
              </p>
              <p className="truncate text-sm text-on-surface-variant">
                {getCrop(activeBookings[0].cropId).name} at{' '}
                {getStorage(activeBookings[0].storageId).name}
              </p>
            </div>
            <Link
              to="/bookings"
              aria-label="View bookings"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10"
            >
              <ChevronRight size={22} strokeWidth={2.5} />
            </Link>
          </div>
        </Card>
      )}

      {/* Aggregation: the core innovation, surfaced on the first screen. */}
      <Card accent="green" className="p-5">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-fixed/60 text-primary">
            <Truck size={24} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Group Booking Available</h2>
            <p className="mt-1.5 text-base leading-relaxed text-on-surface-variant">
              {hasJoinedPool ? (
                <>
                  You are in a pool of {math.memberCount} farmers leaving tomorrow -{' '}
                  <strong className="text-primary">full truck ({kg(math.totalKg)})</strong>.
                </>
              ) : (
                <>
                  {math.neighbourCount} farmers near you pooling a truck for tomorrow - add your lot{' '}
                  <strong className="text-primary">({kg(math.spaceLeftKg)} space left)</strong>.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex -space-x-3">
            {pool.members.map((m) => (
              <span key={m.id} className="rounded-full ring-2 ring-surface-container-lowest">
                <Avatar name={m.name} size={36} />
              </span>
            ))}
            {hasJoinedPool && (
              <span className="rounded-full ring-2 ring-surface-container-lowest">
                <Avatar name="You" size={36} highlight />
              </span>
            )}
          </div>
          <Chip tone="green">Saves {rupee(math.savings)} on transport</Chip>
        </div>

        <div className="mt-5">
          {hasJoinedPool ? (
            <Link to="/group" role="button" className="cc-btn-primary w-full">
              <Bilingual en="View Your Pool" hi="अपना पूल देखें" />
            </Link>
          ) : (
            <button type="button" className="cc-btn-outline w-full" onClick={handleJoin}>
              <Bilingual en="Join Pool" hi="पूल में शामिल हों" />
            </button>
          )}
        </div>
      </Card>

      </div>

      {/* Three tiles of derived state - each is a doorway, not a claim. */}
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
        <Link
          to="/freshness"
          className="rounded-md border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card transition hover:border-primary/40 hover:bg-primary/5"
        >
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <Sprout size={15} strokeWidth={2.5} aria-hidden="true" />
            Your lot / आपका लॉट
          </p>
          <p className="mt-2 text-lg font-bold leading-tight">
            {lotCrop.emoji} {lotCrop.name} · {kg(CURRENT_LOT.quantityKg)}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Batch {CURRENT_LOT.batchId} · fresh for about {lotDecay.remaining} days
          </p>
        </Link>

        <Link
          to="/storage"
          className="rounded-md border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card transition hover:border-primary/40 hover:bg-primary/5"
        >
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <Snowflake size={15} strokeWidth={2.5} aria-hidden="true" />
            Nearest cold storage
          </p>
          <p className="mt-2 text-lg font-bold leading-tight">{nearest.name}</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {nearest.distanceKm} km · {nearest.slotsFree} slots free · ₹{nearest.pricePerKgDay}/kg/day
          </p>
        </Link>

        <Link
          to="/advisor"
          className="rounded-md border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card transition hover:border-primary/40 hover:bg-primary/5"
        >
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <LineChart size={15} strokeWidth={2.5} aria-hidden="true" />
            {lotCrop.name} today · sample
          </p>
          <p className="mt-2 text-lg font-bold leading-tight">{rupee(todayPrice, { decimals: 0 })}/kg</p>
          <p className="mt-1 text-sm text-on-surface-variant">See the 7-day trend and advice →</p>
        </Link>
      </div>
    </div>
  )
}