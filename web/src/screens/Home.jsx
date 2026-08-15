import { Link, useNavigate } from 'react-router-dom'
import { Brain, Camera, ChevronRight, Mic, Package, Truck } from 'lucide-react'
import { useApp } from '../store/context'
import { getCrop, getStorage } from '../data/seed'
import { poolMath, sellOrStore } from '../lib/ai'
import { kg, rupee } from '../lib/format'
import { Avatar, Bilingual, Card, Chip } from '../components/ui'

export default function Home() {
  const { currentLot, pool, hasJoinedPool, activeBookings, joinPool, notify } = useApp()
  const navigate = useNavigate()

  const crop = getCrop(currentLot.cropId)
  const advice = sellOrStore(currentLot.cropId, currentLot.quantityKg)
  const math = poolMath(pool, hasJoinedPool)

  const handleJoin = () => {
    joinPool(pool.id)
    notify('Joined the pool / पूल में शामिल हो गए')
    navigate('/group')
  }

  return (
    <div className="space-y-6">
      {/* Voice booking is the primary action: literacy must never gate a booking. */}
      <Link
        to="/voice"
        role="button"
        className="cc-btn-primary mx-auto w-full max-w-[320px] !py-5 text-base shadow-lifted"
      >
        <Mic size={26} strokeWidth={2.5} aria-hidden="true" />
        <Bilingual en="Speak to Book" hi="बोलकर बुक करें" stacked />
      </Link>

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

      {/* Market insight: the advisor never just says "book" - it says what it earns. */}
      <Card accent="blue" className="p-5">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-tertiary-fixed text-tertiary">
            <Brain size={24} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Market Insights</h2>
            <p className="mt-1.5 text-base leading-relaxed text-on-surface-variant">
              {crop.name}{' '}
              <strong className="text-on-surface">
                {rupee(advice.todayPrice, { decimals: 0 })}/kg
              </strong>{' '}
              today.{' '}
              {advice.action === 'STORE' ? (
                <>
                  Store for {advice.holdDays} days → expected{' '}
                  <strong className="text-primary">+{advice.pctChange.toFixed(0)}% price</strong>.
                </>
              ) : (
                <>
                  Prices are falling this week -{' '}
                  <strong className="text-secondary">selling today is better</strong>.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <button type="button" className="cc-btn-amber w-full" onClick={() => navigate('/marketplace')}>
            <Bilingual en="Sell Now" hi="अभी बेचें" />
          </button>
          <Link to="/advisor" role="button" className="cc-btn-primary w-full">
            <Bilingual en="Store" hi="स्टोर करें" />
          </Link>
        </div>
      </Card>

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

      <Link
        to="/freshness"
        role="button"
        className="cc-btn-outline w-full !py-4"
      >
        <Camera size={20} strokeWidth={2.5} aria-hidden="true" />
        <Bilingual en="Check freshness from a photo" hi="फ़ोटो से ताज़गी जाँचें" />
      </Link>

      <Link
        to="/impact"
        className="flex items-center justify-between rounded-md bg-primary/5 px-5 py-4 text-primary hover:bg-primary/10"
      >
        <span className="font-semibold">
          <Bilingual en="Our cluster impact" hi="हमारा असर" />
        </span>
        <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
      </Link>
    </div>
  )
}
