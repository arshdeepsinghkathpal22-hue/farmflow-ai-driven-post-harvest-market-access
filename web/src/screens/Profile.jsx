import { Link } from 'react-router-dom'
import {
  ChevronRight,
  HelpCircle,
  Languages,
  LayoutDashboard,
  LogIn,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sprout,
} from 'lucide-react'
import { useApp } from '../store/context'
import { Avatar, Bilingual, Card, Chip, SectionTitle } from '../components/ui'
import BRAND from '../brand'

export default function Profile() {
  const {
    farmer,
    bookings,
    purchases,
    joinedPools,
    resetDemo,
    openGuide,
    online,
    demoOffline,
    toggleDemoOffline,
    signedIn,
    session,
  } = useApp()

  return (
    <div className="space-y-5">
      <SectionTitle en="Profile" hi="प्रोफ़ाइल" />

      <Card accent="green" className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={farmer.name} size={64} highlight />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{farmer.name}</h2>
            <p className="text-sm text-on-surface-variant">{farmer.nameHi}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-on-surface-variant">
              <MapPin size={15} strokeWidth={2.5} aria-hidden="true" />
              {farmer.district}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip tone="green" icon={ShieldCheck}>
            Verified farmer
          </Chip>
          <Chip tone="amber" icon={Sprout}>
            {farmer.landAcres} acres · {farmer.category}
          </Chip>
        </div>

        <dl className="mt-4 divide-y divide-outline-variant/50 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <dt className="flex items-center gap-2 text-on-surface-variant">
              <Phone size={16} strokeWidth={2.5} aria-hidden="true" /> Registered mobile
            </dt>
            <dd className="font-semibold">{farmer.phone}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="flex items-center gap-2 text-on-surface-variant">
              <Languages size={16} strokeWidth={2.5} aria-hidden="true" /> App language
            </dt>
            <dd className="font-semibold">हिंदी + English</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-on-surface-variant">Farmer ID</dt>
            <dd className="font-semibold">{farmer.id}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Bookings" value={bookings.length} />
        <MiniStat label="Pools" value={joinedPools.length} />
        <MiniStat label="Orders" value={purchases.length} />
      </div>

      {/* Signing in is what turns local bookings into slots the server actually
          holds, so the state of it belongs where the farmer can see it. */}
      <Link
        to="/login"
        className="flex items-center gap-3 rounded-md bg-primary/5 px-5 py-4 text-primary hover:bg-primary/10"
      >
        <LogIn size={22} strokeWidth={2.5} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {signedIn ? `Signed in as ${session.username}` : 'Sign in to sync bookings'}
          </span>
          <span className="block text-xs font-medium text-on-surface-variant">
            {signedIn
              ? session.mode === 'backend'
                ? 'Bookings are held on the server'
                : 'This device only - no backend was answering'
              : 'Optional. Without it, bookings stay on this phone.'}
          </span>
        </span>
        <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
      </Link>

      <Link
        to="/guide"
        className="flex items-center gap-3 rounded-md bg-primary/5 px-5 py-4 text-primary hover:bg-primary/10"
      >
        <HelpCircle size={22} strokeWidth={2.5} aria-hidden="true" />
        <span className="flex-1 font-semibold">
          <Bilingual en="How to use this app" hi="ऐप कैसे इस्तेमाल करें" />
        </span>
        <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
      </Link>

      <Link
        to="/owner"
        className="flex items-center gap-3 rounded-md bg-inverse-surface px-5 py-4 text-inverse-on-surface hover:bg-primary"
      >
        <LayoutDashboard size={22} strokeWidth={2.5} aria-hidden="true" />
        <span className="flex-1 font-semibold">Open Storage Owner Dashboard</span>
        <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
      </Link>

      {/* Lets the offline story be demonstrated indoors, on good wifi. */}
      <Card accent={online ? 'blue' : 'amber'} className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold">
              <Bilingual en="Simulate no network" hi="नेटवर्क बंद करें" />
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-on-surface-variant">
              Turn this on, make a booking, then turn it off. The booking is held on the phone and
              pushed the moment a signal returns.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={demoOffline}
            aria-label="Simulate no network"
            onClick={toggleDemoOffline}
            className={`relative mt-0.5 h-8 w-14 shrink-0 rounded-full transition ${
              demoOffline ? 'bg-secondary-container' : 'bg-surface-container-highest'
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-surface-container-lowest shadow-card transition-all ${
                demoOffline ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="cc-btn-outline w-full !px-4" onClick={openGuide}>
          <HelpCircle size={18} strokeWidth={2.5} aria-hidden="true" />
          <Bilingual en="Demo guide" hi="गाइड" />
        </button>
        <button type="button" className="cc-btn-outline w-full !px-4" onClick={resetDemo}>
          <RotateCcw size={18} strokeWidth={2.5} aria-hidden="true" />
          <Bilingual en="Reset demo" hi="रीसेट" />
        </button>
      </div>

      {/*
        No competition is named here. The same prototype is entered in more
        than one, each under a different theme, and a build that names one of
        them is wrong in the others. The team and the college do not change.
      */}
      <p className="pb-2 text-center text-xs leading-relaxed text-on-surface-variant">
        {BRAND.name} prototype · Team Kisan Rakshak
        <br />
        Jaypee Institute of Information Technology, Noida
      </p>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-on-surface-variant">{label}</p>
    </Card>
  )
}
