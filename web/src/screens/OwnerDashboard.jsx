import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  BarChart3,
  Bell,
  Clock,
  IndianRupee,
  LayoutGrid,
  MapPin,
  Package,
  Phone,
  Settings,
  ShieldCheck,
  Snowflake,
  Thermometer,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react'
import {
  OWNER,
  OWNER_ANALYTICS,
  OWNER_INVENTORY,
  OWNER_PAYMENTS,
  OWNER_SETTINGS,
  OWNER_STAFF,
  getCrop,
  getStorage,
} from '../data/seed'
import { useApp } from '../store/context'
import { shelfTone, spoilage } from '../lib/ai'
import { kg, rupee, rupeeCompact, tempLabel } from '../lib/format'
import { Avatar, BarChart, Card, Chip, ProgressBar } from '../components/ui'
import BRAND from '../brand'

const SECTIONS = [
  {
    id: 'inventory',
    label: 'Inventory',
    hi: 'माल-सूची',
    icon: Package,
    title: 'Stored Inventory',
    sub: 'Every lot currently inside the facility, with its remaining shelf life',
  },
  {
    id: 'occupancy',
    label: 'Occupancy',
    hi: 'अधिभोग',
    icon: LayoutGrid,
    title: 'Occupancy Overview',
    sub: 'Real-time facility utilisation and incoming slots',
  },
  {
    id: 'payments',
    label: 'Payments',
    hi: 'भुगतान',
    icon: Banknote,
    title: 'Payments & Settlement',
    sub: 'What has been collected, and what the platform still owes you',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    hi: 'विश्लेषण',
    icon: BarChart3,
    title: 'Analytics',
    sub: 'What accepting micro-slots and pooled lots did to the business',
  },
  {
    id: 'staff',
    label: 'Staff',
    hi: 'कर्मचारी',
    icon: Users,
    title: 'Staff',
    sub: 'Who is on duty across the facility right now',
  },
  {
    id: 'settings',
    label: 'Settings',
    hi: 'सेटिंग्स',
    icon: Settings,
    title: 'Facility Settings',
    sub: 'Chambers, pricing, and what this facility is willing to accept',
  },
]

const ALERT_ICONS = { truck: Truck, money: Banknote, temp: Thermometer }

const STATUS_TONE = {
  Confirmed: 'green',
  'Arriving Soon': 'blue',
  Pending: 'amber',
  Settled: 'green',
  Processing: 'blue',
}

export default function OwnerDashboard() {
  const [active, setActive] = useState('occupancy')
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[1]

  return (
    <div className="min-h-screen bg-surface lg:flex">
      <aside className="min-w-0 border-b border-outline-variant/40 bg-surface-container-low px-5 py-5 lg:min-h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <Avatar name={OWNER.ownerName} size={48} highlight />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-primary">Owner Dashboard</p>
            <p className="truncate text-sm text-on-surface-variant">{BRAND.name} Pro</p>
          </div>
        </div>

        <nav className="mt-6" aria-label="Dashboard sections">
          <ul className="flex max-w-full gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
            {SECTIONS.map(({ id, label, hi, icon: Icon }) => (
              <li key={id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => setActive(id)}
                  aria-current={active === id ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-semibold transition ${
                    active === id
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-primary/5'
                  }`}
                >
                  <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
                  <span className="whitespace-nowrap">
                    {label} <span className="font-medium opacity-90">/ {hi}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          to="/login"
          className="mt-8 hidden items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5 lg:flex"
        >
          <ArrowLeft size={18} strokeWidth={2.5} aria-hidden="true" />
          Back to sign in / switch role
        </Link>
      </aside>

      <main className="flex-1 px-5 py-6 lg:px-10 lg:py-8">
        <Link
          to="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary lg:hidden"
        >
          <ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" />
          Sign in / switch role
        </Link>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">{section.title}</h1>
          <p className="mt-1 text-base text-on-surface-variant">
            {section.sub} · {OWNER.facility}
          </p>
        </header>

        {active === 'occupancy' && <Occupancy />}
        {active === 'inventory' && <Inventory />}
        {active === 'payments' && <Payments />}
        {active === 'analytics' && <Analytics />}
        {active === 'staff' && <Staff />}
        {active === 'settings' && <FacilitySettings />}

        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/5 lg:hidden"
        >
          <ArrowLeft size={18} strokeWidth={2.5} aria-hidden="true" />
          Back to sign in / switch role
        </Link>
      </main>
    </div>
  )
}

/* ── Occupancy ─────────────────────────────────────────────────────────── */

function Occupancy() {
  const { bookings } = useApp()

  // This console belongs to one facility, so only bookings actually routed
  // here show up - a lot sent to another warehouse is not this owner's business.
  const sessionBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'CONFIRMED')
        .filter((b) => getStorage(b.storageId).name === OWNER.facility)
        .map((b) => ({
          id: b.id,
          farmers: 'Rajesh Kumar (you)',
          initials: ['R'],
          volumeKg: b.quantityKg,
          pooled: b.pooled,
          arrival: b.pickup,
          status: 'Confirmed',
          live: true,
        })),
    [bookings],
  )

  const incoming = [...sessionBookings, ...OWNER.incoming]

  // Every chamber, not just the first. The grid stays two-state - filled or
  // empty; which crop, whose lot and how urgent it is live in the list below
  // and in the Inventory table.
  const [chamberId, setChamberId] = useState(OWNER.chambers[0].id)
  const chamber = OWNER.chambers.find((c) => c.id === chamberId) ?? OWNER.chambers[0]
  const filled = chamber.filled
  const chamberLots = OWNER_INVENTORY.filter((l) => l.chamber === chamberId).map((l) => ({
    ...l,
    decay: spoilage(l.cropId, l.daysStored),
  }))
  const slots = Array.from({ length: chamber.slots }, (_, i) => i < filled)

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total Occupancy"
          labelHi="कुल अधिभोग"
          value={`${OWNER.occupancyPct}%`}
          sub={`${OWNER.chambers.length} chambers · ${OWNER.chambers.reduce((n, c) => n + c.slots, 0)} micro-slots`}
          icon={LayoutGrid}
          tone="green"
        />
        <StatCard
          label="Avg Temp"
          labelHi="औसत तापमान"
          value={`${OWNER.avgTempC}°C`}
          sub={`Optimal range (${OWNER.optimalRange[0]}-${OWNER.optimalRange[1]}°C)`}
          icon={Thermometer}
          tone="blue"
        />
        <StatCard
          label="Revenue (month)"
          labelHi="आय"
          value={rupeeCompact(OWNER.revenueMonth)}
          sub={`Expected: ${rupeeCompact(OWNER.revenueExpected)}`}
          icon={IndianRupee}
          tone="amber"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card accent="blue" className="min-w-0 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">Chamber {chamber.id}: Slot View</h2>
              <div className="flex gap-1.5" role="tablist" aria-label="Choose chamber">
                {OWNER.chambers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={c.id === chamberId}
                    onClick={() => setChamberId(c.id)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                      c.id === chamberId
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10'
                    }`}
                  >
                    {c.id}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-primary" aria-hidden="true" /> Filled
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-surface-container-highest" aria-hidden="true" />{' '}
                Empty
              </span>
            </div>
          </div>

          {/* Micro-slots, not one bulk block - this is what lets 50 kg lots exist. */}
          <div
            className="mt-5 grid grid-cols-12 gap-2"
            role="img"
            aria-label={`Chamber ${chamber.id}: ${filled} of ${chamber.slots} micro-slots filled`}
          >
            {slots.map((isFilled, i) => (
              <span
                key={i}
                className={`aspect-square rounded-full ${
                  isFilled ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-on-surface-variant">
            {filled} of {chamber.slots} micro-slots filled · each slot holds{' '}
            {OWNER_SETTINGS.slotSizeKg} kg
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {chamberLots.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="mr-1.5" aria-hidden="true">{getCrop(l.cropId).emoji}</span>
                  #{l.id} · {getCrop(l.cropId).name} · {l.farmer} · {kg(l.qtyKg)}
                </span>
                <Chip tone={shelfTone(l.decay.remaining)} className="shrink-0">
                  {l.decay.remaining} day{l.decay.remaining === 1 ? '' : 's'} left
                </Chip>
              </li>
            ))}
          </ul>
        </Card>

        <Card accent="green" className="min-w-0 p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Bell size={22} strokeWidth={2.5} className="text-primary" aria-hidden="true" />
            Recent Alerts
          </h2>
          <ul className="mt-4 space-y-3">
            {OWNER.alerts.map((a) => {
              const Icon = ALERT_ICONS[a.icon] ?? Bell
              return (
                <li key={a.id} className="flex gap-3 rounded-md bg-surface-container-low p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-container-high text-primary">
                    <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{a.title}</p>
                    <p className="mt-0.5 text-sm text-on-surface-variant">{a.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <Card accent="green" className="mt-5 p-6">
        <h2 className="text-xl font-bold">
          Incoming Bookings <span className="font-semibold text-on-surface-variant">/ आने वाली बुकिंग</span>
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase tracking-wide text-on-surface-variant">
                <th scope="col" className="pb-3 pr-4 font-semibold">Booking ID</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Farmers</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Volume</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Arrival</th>
                <th scope="col" className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {incoming.map((b) => (
                <tr key={b.id} className={b.live ? 'bg-primary/5' : ''}>
                  <td className="py-4 pr-4 font-semibold">
                    #{b.id}
                    {b.live && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-on-primary">
                        NEW
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {b.initials.map((ini, i) => (
                          <span
                            key={i}
                            className="grid h-8 w-8 place-items-center rounded-full bg-surface-container-high text-xs font-bold ring-2 ring-surface-container-lowest"
                          >
                            {ini}
                          </span>
                        ))}
                      </div>
                      <span className="whitespace-nowrap text-sm">{b.farmers}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 font-bold">
                    {kg(b.volumeKg)}
                    {b.pooled && (
                      <span className="ml-1 text-xs font-semibold text-primary">(Pooled)</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-sm">{b.arrival}</td>
                  <td className="py-4">
                    <Chip tone={STATUS_TONE[b.status] ?? 'neutral'}>{b.status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 rounded-md bg-primary/5 px-4 py-3 text-sm text-primary">
          Pooled consignments arrive as one pallet-level booking, so a 450 kg truck costs the same
          handling effort as a single bulk lot - the reason micro-slots become profitable.
        </p>
      </Card>
    </>
  )
}

/* ── Inventory ─────────────────────────────────────────────────────────── */

function Inventory() {
  const lots = OWNER_INVENTORY.map((lot) => ({
    ...lot,
    crop: getCrop(lot.cropId),
    decay: spoilage(lot.cropId, lot.daysStored),
  }))

  const totalKg = lots.reduce((sum, l) => sum + l.qtyKg, 0)
  const atRisk = lots.filter((l) => l.decay.urgency !== 'ok')
  const pooledShare = Math.round((lots.filter((l) => l.pooled).length / lots.length) * 100)

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stored now" labelHi="कुल माल" value={kg(totalKg)} sub={`${lots.length} active lots`} icon={Package} tone="green" />
        <StatCard label="Lots at risk" labelHi="जोखिम" value={String(atRisk.length)} sub="Four days or less of shelf life" icon={AlertTriangle} tone="amber" />
        <StatCard label="Pooled lots" labelHi="पूल्ड" value={`${pooledShare}%`} sub="Arrived as part of a shared consignment" icon={Truck} tone="blue" />
        <StatCard label="Chambers in use" labelHi="चैम्बर" value={String(OWNER_SETTINGS.chambers.length)} sub="A and B, both within band" icon={Snowflake} tone="green" />
      </div>

      {atRisk.length > 0 && (
        <Card accent="amber" className="mt-5 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <AlertTriangle size={20} strokeWidth={2.5} className="text-secondary" aria-hidden="true" />
            Move these first
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {atRisk.map((l) => `${l.crop.name} (${l.id})`).join(', ')} -{' '}
            {atRisk.length > 1 ? 'these lots are' : 'this lot is'} close to the end of shelf life.
            They are already surfaced to buyers as priority deals.
          </p>
        </Card>
      )}

      <Card accent="green" className="mt-5 p-6">
        <h2 className="text-xl font-bold">
          Current Lots <span className="font-semibold text-on-surface-variant">/ मौजूदा माल</span>
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase tracking-wide text-on-surface-variant">
                <th scope="col" className="pb-3 pr-4 font-semibold">Lot</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Crop</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Farmer</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Quantity</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Chamber</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Stored</th>
                <th scope="col" className="pb-3 font-semibold">Shelf life left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {lots.map((l) => {
                const tone = shelfTone(l.decay.remaining)
                return (
                <tr
                  key={l.id}
                  className={
                    tone === 'red'
                      ? 'bg-error-container/50'
                      : tone === 'amber'
                        ? 'bg-secondary-container/25'
                        : 'bg-primary/5'
                  }
                >
                  <td className="rounded-l-md py-4 pl-3 pr-4 font-semibold">
                    #{l.id}
                    {l.pooled && (
                      <span className="ml-2 text-xs font-semibold text-primary">Pooled</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4">
                    <span className="mr-1.5" aria-hidden="true">{l.crop.emoji}</span>
                    {l.crop.name}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-sm">{l.farmer}</td>
                  <td className="whitespace-nowrap py-4 pr-4 font-bold">{kg(l.qtyKg)}</td>
                  <td className="py-4 pr-4">
                    <Chip tone="blue">Chamber {l.chamber}</Chip>
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-sm">
                    {l.daysStored} day{l.daysStored === 1 ? '' : 's'}
                  </td>
                  <td className="rounded-r-md py-4 pr-3">
                    <Chip tone={tone}>
                      {l.decay.remaining} days
                    </Chip>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ── Payments ──────────────────────────────────────────────────────────── */

function Payments() {
  const p = OWNER_PAYMENTS
  const settled = p.ledger.filter((l) => l.status === 'Settled').reduce((s, l) => s + l.amount, 0)
  const pooledRevenue = p.ledger.filter((l) => l.pooled).reduce((s, l) => s + l.amount, 0)
  const totalLedger = p.ledger.reduce((s, l) => s + l.amount, 0)
  const pooledPct = Math.round((pooledRevenue / totalLedger) * 100)

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Received (month)" labelHi="प्राप्त" value={rupeeCompact(p.receivedMonth)} sub={`${rupee(settled)} settled in the ledger below`} icon={Banknote} tone="green" />
        <StatCard label="Pending settlement" labelHi="बाकी" value={rupeeCompact(p.pendingSettlement)} sub={`Releases on ${p.nextSettlementOn}`} icon={Clock} tone="amber" />
        <StatCard label="From pooled lots" labelHi="पूल्ड से" value={`${pooledPct}%`} sub="Share of revenue that micro-slots unlocked" icon={Truck} tone="blue" />
      </div>

      <Card accent="green" className="mt-5 p-6">
        <h2 className="text-xl font-bold">
          Settlement Ledger <span className="font-semibold text-on-surface-variant">/ भुगतान विवरण</span>
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase tracking-wide text-on-surface-variant">
                <th scope="col" className="pb-3 pr-4 font-semibold">Booking</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Date</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">From</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Amount</th>
                <th scope="col" className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {p.ledger.map((l) => (
                <tr key={l.id}>
                  <td className="py-4 pr-4 font-semibold">
                    #{l.id}
                    {l.pooled && (
                      <span className="ml-2 text-xs font-semibold text-primary">Pooled</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-sm">{l.date}</td>
                  <td className="whitespace-nowrap py-4 pr-4 text-sm">{l.from}</td>
                  <td className="whitespace-nowrap py-4 pr-4 font-bold">{rupee(l.amount)}</td>
                  <td className="py-4">
                    <Chip tone={STATUS_TONE[l.status] ?? 'amber'}>{l.status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 rounded-md bg-primary/5 px-4 py-3 text-sm text-primary">
          The platform collects from farmers and buyers and settles to you in one payment, so a
          450 kg pooled consignment is a single receivable rather than four people to chase.
        </p>
      </Card>
    </>
  )
}

/* ── Analytics ─────────────────────────────────────────────────────────── */

function Analytics() {
  const a = OWNER_ANALYTICS
  const maxRevenue = Math.max(...a.months.map((m) => m.revenue))
  const first = a.months[0]
  const last = a.months[a.months.length - 1]
  const lotDrop = Math.round(((a.avgLotKgBefore - a.avgLotKgNow) / a.avgLotKgBefore) * 100)

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Occupancy growth"
          labelHi="वृद्धि"
          value={`+${last.occupancyPct - first.occupancyPct} pts`}
          sub={`${first.occupancyPct}% in ${first.month} → ${last.occupancyPct}% in ${last.month}`}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          label="Pooled share"
          labelHi="पूल्ड हिस्सा"
          value={`${last.pooledPct}%`}
          sub={`Up from ${first.pooledPct}% six months ago`}
          icon={Truck}
          tone="blue"
        />
        <StatCard
          label="Average lot size"
          labelHi="औसत लॉट"
          value={kg(a.avgLotKgNow)}
          sub={`${lotDrop}% smaller than before micro-slots`}
          icon={Package}
          tone="amber"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card accent="green" className="p-6">
          <h2 className="text-xl font-bold">Revenue by month</h2>
          <p className="text-sm text-on-surface-variant">Storage fees collected through the platform</p>
          <div className="mt-5">
            <BarChart
              heightClass="h-48"
              gapClass="gap-3"
              ariaLabel="Monthly revenue trend"
              items={a.months.map((m) => ({
                key: m.month,
                pct: (m.revenue / maxRevenue) * 100,
                topLabel: rupeeCompact(m.revenue),
                bottomLabel: m.month,
                barClass: 'bg-gradient-to-t from-primary to-primary-container',
              }))}
            />
          </div>
        </Card>

        <Card accent="blue" className="p-6">
          <h2 className="text-xl font-bold">Occupancy vs pooled share</h2>
          <p className="text-sm text-on-surface-variant">
            Utilisation rose as pooled consignments replaced empty space
          </p>
          <ul className="mt-5 space-y-4">
            {a.months.map((m) => (
              <li key={m.month}>
                <div className="mb-1 flex justify-between text-sm font-medium">
                  <span>{m.month}</span>
                  <span className="text-on-surface-variant">
                    {m.occupancyPct}% full · {m.pooledPct}% pooled
                  </span>
                </div>
                <ProgressBar value={m.occupancyPct} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <MicroSlotSimulator />

      <Card accent="amber" className="mt-5 p-6">
        <h2 className="text-xl font-bold">Crop mix by stored weight</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {a.cropMix.map((c) => {
            const crop = getCrop(c.cropId)
            return (
              <li key={c.cropId} className="rounded-md bg-surface-container-low p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="text-xl" aria-hidden="true">{crop.emoji}</span>
                  {crop.name}
                </p>
                <p className="mt-2 text-2xl font-bold text-primary">{c.sharePct}%</p>
                <div className="mt-2">
                  <ProgressBar value={c.sharePct} />
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </>
  )
}

/* ── What-if simulator ─────────────────────────────────────────────────── */

/**
 * The core business claim, made testable: bulk demand alone leaves roughly a
 * fifth of the building empty, and micro-slots fill that gap because the demand
 * for them is currently unmet. Drag the slider and watch both sides move.
 */
function MicroSlotSimulator() {
  const s = OWNER_SETTINGS
  const totalKg = s.capacityMt * 1000
  const CURRENT_SHARE = 4.5

  const [share, setShare] = useState(CURRENT_SHARE)

  const project = (pct) => {
    const microKg = (totalKg * pct) / 100
    const bulkKg = totalKg - microKg
    const storedKg = bulkKg * s.bulkFillRate + microKg * s.microFillRate
    return {
      microKg,
      occupancyPct: (storedKg / totalKg) * 100,
      revenue: storedKg * s.pricePerKgDay * 30,
      farmers: Math.round(microKg / s.avgMicroLotKg),
    }
  }

  const now = project(share)
  const bulkOnly = project(0)
  const revenueDelta = now.revenue - bulkOnly.revenue

  return (
    <Card accent="green" className="mt-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">What if you opened more capacity to micro-slots?</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Projected from a {s.capacityMt} tonne facility at {rupee(s.pricePerKgDay, { decimals: 2 })} per
            kg per day, over a 30 day cycle.
          </p>
        </div>
        <Chip tone={share === CURRENT_SHARE ? 'neutral' : 'green'}>
          {share === CURRENT_SHARE ? 'Where you are today' : 'Projection'}
        </Chip>
      </div>

      <div className="mt-5">
        <label htmlFor="cc-share" className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">Capacity offered as micro-slots</span>
          <span className="text-2xl font-bold text-primary">{share.toFixed(1)}%</span>
        </label>
        <input
          id="cc-share"
          type="range"
          min="0"
          max="25"
          step="0.5"
          value={share}
          onChange={(e) => setShare(Number(e.target.value))}
          className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-container-highest accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs font-medium text-on-surface-variant">
          <span>Bulk only</span>
          <span>{kg(now.microKg)} set aside</span>
          <span>25%</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md bg-surface-container-low p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Projected occupancy
          </p>
          <p className="mt-1 text-3xl font-bold text-primary">{now.occupancyPct.toFixed(1)}%</p>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {(now.occupancyPct - bulkOnly.occupancyPct).toFixed(1)} points above bulk-only
          </p>
        </div>
        <div className="rounded-md bg-surface-container-low p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Monthly revenue
          </p>
          <p className="mt-1 text-3xl font-bold text-tertiary">{rupeeCompact(now.revenue)}</p>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {revenueDelta >= 0 ? '+' : ''}
            {rupee(Math.round(revenueDelta))} vs bulk-only
          </p>
        </div>
        <div className="rounded-md bg-surface-container-low p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Small farmers served
          </p>
          <p className="mt-1 text-3xl font-bold text-secondary">{now.farmers}</p>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            At an average lot of {kg(s.avgMicroLotKg)}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-md bg-primary/5 px-4 py-3 text-sm text-primary">
        The occupancy gain is real but modest - the point is the third number. Every one of those
        farmers is turned away today, and each becomes a repeat customer the platform routes back to
        you next season.
      </p>
    </Card>
  )
}

/* ── Staff ─────────────────────────────────────────────────────────────── */

function Staff() {
  const onDuty = OWNER_STAFF.filter((s) => s.onDuty)

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total staff" labelHi="कुल" value={String(OWNER_STAFF.length)} sub="Across all shifts" icon={Users} tone="green" />
        <StatCard label="On duty now" labelHi="ड्यूटी पर" value={String(onDuty.length)} sub={onDuty.map((s) => s.name.split(' ')[0]).join(', ')} icon={ShieldCheck} tone="blue" />
        <StatCard label="Chambers covered" labelHi="चैम्बर" value={String(OWNER_SETTINGS.chambers.length)} sub="One technician per night shift" icon={Snowflake} tone="amber" />
      </div>

      <ul className="mt-5 grid gap-5 sm:grid-cols-2">
        {OWNER_STAFF.map((s) => (
          <li key={s.id}>
            <Card accent={s.onDuty ? 'green' : 'none'} className="p-5">
              <div className="flex items-start gap-4">
                <Avatar name={s.name} size={52} highlight={s.onDuty} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{s.name}</h3>
                    <Chip tone={s.onDuty ? 'green' : 'neutral'}>
                      {s.onDuty ? 'On duty' : 'Off shift'}
                    </Chip>
                  </div>
                  <p className="mt-0.5 font-medium text-on-surface-variant">{s.role}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
                    <Clock size={16} strokeWidth={2.5} aria-hidden="true" />
                    {s.shift}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
                    <Phone size={16} strokeWidth={2.5} aria-hidden="true" />
                    {s.phone}
                  </p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ── Settings ──────────────────────────────────────────────────────────── */

function FacilitySettings() {
  const s = OWNER_SETTINGS
  const [toggles, setToggles] = useState(() =>
    Object.fromEntries(s.toggles.map((t) => [t.id, t.on])),
  )

  const flip = (id) => setToggles((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card accent="green" className="p-6">
          <h2 className="text-xl font-bold">Facility</h2>
          <dl className="mt-4 divide-y divide-outline-variant/50 text-sm">
            <Row label="Name" value={s.facility} />
            <Row label="Address" value={s.address} icon={MapPin} />
            <Row label="Licence" value={s.licenceNo} icon={ShieldCheck} />
            <Row label="Capacity" value={`${s.capacityMt.toLocaleString('en-IN')} MT`} />
            <Row label="Slot size" value={`${s.slotSizeKg} kg per micro-slot`} />
            <Row label="Minimum booking" value={kg(s.minBookingKg)} />
            <Row label="Rate" value={`${rupee(s.pricePerKgDay, { decimals: 2 })} per kg per day`} icon={IndianRupee} />
          </dl>
        </Card>

        <Card accent="blue" className="p-6">
          <h2 className="text-xl font-bold">Chambers</h2>
          <ul className="mt-4 space-y-4">
            {s.chambers.map((c) => (
              <li key={c.id} className="rounded-md bg-surface-container-low p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold">Chamber {c.id}</h3>
                  <Chip tone="blue" icon={Thermometer}>{tempLabel(c.tempRange)}</Chip>
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">Typically holds: {c.crops}</p>
                <div className="mt-3">
                  <ProgressBar
                    value={(c.filled / c.slots) * 100}
                    label={`${c.filled} of ${c.slots} slots`}
                    trailing={`${Math.round((c.filled / c.slots) * 100)}% full`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card accent="amber" className="mt-5 p-6">
        <h2 className="text-xl font-bold">
          Preferences <span className="font-semibold text-on-surface-variant">/ सेटिंग्स</span>
        </h2>
        <ul className="mt-4 divide-y divide-outline-variant/50">
          {s.toggles.map((t) => {
            const on = toggles[t.id]
            return (
              <li key={t.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t.label} <span className="font-medium text-on-surface-variant">/ {t.hi}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-on-surface-variant">{t.note}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t.label}
                  onClick={() => flip(t.id)}
                  className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors ${
                    on ? 'justify-end bg-primary' : 'justify-start bg-outline-variant'
                  }`}
                >
                  <span className="h-6 w-6 rounded-full bg-white shadow-card" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>

        {!toggles.micro && (
          <p className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
            With micro-slots off, this facility goes back to bulk-only - every lot under{' '}
            {kg(450)} would be turned away at the gate.
          </p>
        )}
      </Card>
    </>
  )
}

function Row({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="flex shrink-0 items-center gap-2 text-on-surface-variant">
        {Icon ? <Icon size={16} strokeWidth={2.5} className="text-primary" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  )
}

/* ── Shared ────────────────────────────────────────────────────────────── */

function StatCard({ label, labelHi, value, sub, icon: Icon, tone }) {
  const tones = {
    green: { accent: 'cc-accent-green', badge: 'bg-primary text-on-primary' },
    blue: { accent: 'cc-accent-blue', badge: 'bg-tertiary-container text-on-tertiary' },
    amber: { accent: 'cc-accent-amber', badge: 'bg-secondary-container text-on-secondary-container' },
  }
  const t = tones[tone] ?? tones.green
  return (
    <Card className={`${t.accent} p-6`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          {label} <span className="normal-case">/ {labelHi}</span>
        </p>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${t.badge}`}>
          <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-4xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{sub}</p>
    </Card>
  )
}
