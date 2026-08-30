import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, IndianRupee, MapPin, Route, Truck, X } from 'lucide-react'
import { useApp } from '../store/context'
import { FARM_POINT, GROUP_POOL, TRANSPORTERS, getCrop, getStorage, STORAGES } from '../data/seed'
import { kg, rupee } from '../lib/format'
import ClusterMap from '../components/ClusterMap'
import { Card, Chip, SectionTitle } from '../components/ui'

/**
 * The transporter's console.
 *
 * The demand side already exists in the data: every confirmed booking is a lot
 * that must physically reach a facility, and the pool is a multi-stop run. This
 * screen turns those into priced pickup jobs for the nearest driver - distance
 * from the schematic map, price from the driver's own base fare and per-km
 * rate plus a weight component, and the decision is the driver's: accept or
 * decline, nothing is assigned over their head.
 *
 * Device-local like the owner console, and it says so.
 */

/** Straight-line distance on the schematic map, scaled so it reads in km. */
const PX_PER_KM = 26
const distKm = (a, b) => Math.round((Math.hypot(a.x - b.x, a.y - b.y) / PX_PER_KM) * 10) / 10

function priceJob(driver, tripKm, totalKg) {
  return Math.round(driver.baseFare + tripKm * driver.ratePerKm + totalKg * 0.35)
}

export default function TransporterHub() {
  const { activeBookings, hasJoinedPool, transportJobs, setTransportJob, notify } = useApp()

  // This demo signs the first seeded driver in.
  const driver = TRANSPORTERS[0]

  const jobs = useMemo(() => {
    const list = []

    // The pool is one multi-stop run.
    const poolStops = [...GROUP_POOL.members, ...(hasJoinedPool ? [{ id: 'you', name: 'Rajesh', village: 'Rampur', qtyKg: GROUP_POOL.yourLotKg, map: FARM_POINT }] : [])]
    const poolDest = getStorage(GROUP_POOL.storageId)
    const poolKg = poolStops.reduce((sum, m) => sum + m.qtyKg, 0)
    const poolKm =
      Math.round(
        (poolStops.reduce((sum, m) => sum + distKm(m.map ?? FARM_POINT, poolDest.map), 0) +
          distKm(driver.map, poolStops[0]?.map ?? FARM_POINT)) *
          10,
      ) / 10
    list.push({
      id: `JOB-${GROUP_POOL.id}`,
      kind: 'pool',
      title: `Pooled run · ${poolStops.length} stops`,
      stops: poolStops,
      dest: poolDest,
      totalKg: poolKg,
      tripKm: poolKm,
      price: priceJob(driver, poolKm, poolKg),
    })

    // Every live solo booking is a farm-to-facility pickup.
    activeBookings
      .filter((b) => !b.pooled)
      .slice(0, 6)
      .forEach((b) => {
        const dest = getStorage(b.storageId)
        const tripKm = Math.round((distKm(driver.map, FARM_POINT) + distKm(FARM_POINT, dest.map)) * 10) / 10
        list.push({
          id: `JOB-${b.id}`,
          kind: 'solo',
          title: `${getCrop(b.cropId).name} · booking #${b.id}`,
          stops: [{ id: b.id, name: 'Rajesh', village: 'Rampur', qtyKg: b.quantityKg, map: FARM_POINT }],
          dest,
          totalKg: b.quantityKg,
          tripKm,
          price: priceJob(driver, tripKm, b.quantityKg),
          pickup: b.pickup,
        })
      })

    // Nearest work first - that is what "most near driver" means in practice.
    return list.sort((a, b) => a.tripKm - b.tripKm)
  }, [activeBookings, hasJoinedPool, driver])

  const decide = (job, status) => {
    setTransportJob(job.id, status)
    notify(
      status === 'ACCEPTED'
        ? `Job accepted - ${rupee(job.price)} / काम स्वीकार`
        : 'Job declined / अस्वीकार',
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 pb-16 pt-6 lg:max-w-[1100px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/login" className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" /> Sign in
        </Link>
        <Chip tone="amber">Device-local demo console</Chip>
      </div>

      <SectionTitle
        en="Transport Jobs"
        hi="ट्रांसपोर्ट काम"
        sub="Pickup work in your cluster, nearest first. The price is yours to accept or decline - nothing is assigned over your head."
      />

      <div className="lg:grid lg:grid-cols-[0.95fr,1.05fr] lg:items-start lg:gap-6">
      <div className="mt-5 lg:sticky lg:top-6 lg:mt-4">
        <ClusterMap
          title="Pickup cluster"
          storages={STORAGES}
          members={GROUP_POOL.members}
          farm={FARM_POINT}
          transporters={[driver]}
          routeTo={GROUP_POOL.storageId}
        />
      </div>

      <div>
      <Card accent="green" className="mt-4 p-4">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
            <Truck size={24} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight">{driver.name}</h2>
            <p className="text-sm text-on-surface-variant">{driver.vehicle}</p>
          </div>

        </div>
        <p className="mt-3 text-xs text-on-surface-variant">
          Base fare {rupee(driver.baseFare)} + {rupee(driver.ratePerKm)}/km + ₹0.35/kg
        </p>
      </Card>

      <ul className="mt-5 space-y-4">
        {jobs.map((job) => {
          const status = transportJobs[job.id]
          return (
            <li key={job.id}>
              <Card accent={status === 'ACCEPTED' ? 'green' : status === 'DECLINED' ? 'red' : 'blue'} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold leading-tight">{job.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} strokeWidth={2.5} aria-hidden="true" />
                        {job.dest.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Route size={14} strokeWidth={2.5} aria-hidden="true" />
                        {job.tripKm} km
                      </span>
                      <span>{kg(job.totalKg)}</span>
                      {job.pickup && <span>{job.pickup}</span>}
                    </p>
                  </div>
                  <p className="flex shrink-0 items-center text-xl font-bold text-primary">
                    <IndianRupee size={18} strokeWidth={2.8} aria-hidden="true" />
                    {job.price.toLocaleString('en-IN')}
                  </p>
                </div>

                {job.kind === 'pool' && (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Stops: {job.stops.map((s) => `${s.name} (${s.qtyKg} kg)`).join(' → ')} → {job.dest.name}
                  </p>
                )}

                {status ? (
                  <Chip tone={status === 'ACCEPTED' ? 'green' : 'red'} className="mt-3">
                    {status === 'ACCEPTED' ? `Accepted · ${rupee(job.price)}` : 'Declined'}
                  </Chip>
                ) : (
                  <div className="mt-4 flex gap-3">
                    <button type="button" className="cc-btn-primary flex-1" onClick={() => decide(job, 'ACCEPTED')}>
                      <Check size={18} strokeWidth={2.8} aria-hidden="true" /> Accept
                    </button>
                    <button type="button" className="cc-btn-outline flex-1" onClick={() => decide(job, 'DECLINED')}>
                      <X size={18} strokeWidth={2.8} aria-hidden="true" /> Decline
                    </button>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      {jobs.length === 1 && (
        <p className="mt-4 text-center text-sm text-on-surface-variant">
          Solo pickup jobs appear here as farmers make bookings in the app.
        </p>
      )}
      </div>
      </div>
    </div>
  )
}
