import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  Calendar,
  CloudOff,
  Home,
  RefreshCw,
  Store,
  TrendingUp,
  User,
} from 'lucide-react'
import { useApp } from '../store/context'
import { Avatar, Bilingual } from './ui'
import DemoGuide from './DemoGuide'

const NAV = [
  { to: '/', en: 'Home', hi: 'होम', icon: Home, end: true },
  { to: '/bookings', en: 'Bookings', hi: 'बुकिंग', icon: Calendar },
  { to: '/advisor', en: 'Prices', hi: 'कीमतें', icon: TrendingUp },
  { to: '/marketplace', en: 'Sell', hi: 'बेचें', icon: Store },
  { to: '/profile', en: 'Profile', hi: 'प्रोफ़ाइल', icon: User },
]

function TopBar() {
  const { farmer, activeBookings } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant/30 bg-surface/95 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {isHome ? (
          <Avatar name={farmer.name} size={44} />
        ) : (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10"
          >
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
        )}

        <p className="min-w-0 flex-1 truncate text-base font-bold text-primary">
          {farmer.name} <span className="font-semibold">/ {farmer.villageHi}</span>
        </p>

        <NavLink
          to="/bookings"
          aria-label={`Notifications: ${activeBookings.length} active bookings`}
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-primary/10"
        >
          <Bell size={22} strokeWidth={2.5} />
          {activeBookings.length > 0 && (
            <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error">
              {activeBookings.length}
            </span>
          )}
        </NavLink>
      </div>
    </header>
  )
}

/** Connectivity is a first-class state here, not an error case. */
function NetworkBanner() {
  const { online, syncing, queuedCount } = useApp()
  if (online && !syncing) return null

  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold ${
        online ? 'bg-tertiary-fixed text-tertiary' : 'bg-secondary-fixed text-on-secondary-container'
      }`}
    >
      {online ? (
        <>
          <RefreshCw size={16} strokeWidth={2.5} className="animate-spin" aria-hidden="true" />
          Back online - syncing {queuedCount} booking{queuedCount === 1 ? '' : 's'}…
        </>
      ) : (
        <>
          <CloudOff size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>
            Offline - bookings are saved on this phone{' '}
            <span className="font-medium">/ बिना नेटवर्क भी बुकिंग चलेगी</span>
          </span>
        </>
      )}
    </div>
  )
}

function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="sticky bottom-0 z-20 border-t border-outline-variant/30 bg-surface-container-lowest/95 px-2 pb-2 pt-2 shadow-[0_-4px_14px_rgba(27,122,67,0.06)] backdrop-blur lg:hidden"
    >
      <ul className="flex items-stretch justify-between">
        {NAV.map(({ to, en, hi, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-full min-h-[56px] flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[11px] transition ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-card'
                    : 'text-on-surface-variant hover:bg-primary/5'
                }`
              }
            >
              <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
              <Bilingual en={en} hi={hi} stacked className="text-[11px]" />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  const tone =
    toast.tone === 'error'
      ? 'bg-error text-on-error'
      : 'bg-inverse-surface text-inverse-on-surface'
  return (
    <div
      role="status"
      className={`pointer-events-none fixed bottom-24 left-1/2 z-50 w-[min(90vw,380px)] -translate-x-1/2 animate-slide-up rounded-full px-5 py-3 text-center text-sm font-semibold shadow-lifted ${tone}`}
    >
      {toast.message}
    </div>
  )
}

export default function FarmerLayout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-surface-container">
      {/* One codebase, two shells: a phone column on phones, and on a laptop a
          left navigation rail with the content given real width - not an
          Android screen marooned in the middle of a monitor. */}
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] bg-surface shadow-lifted lg:max-w-none lg:shadow-none">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-outline-variant/40 bg-surface-container-lowest px-4 py-6 lg:flex">
          <p className="px-3 text-xl font-extrabold tracking-tight text-primary">FarmFlow</p>
          <nav aria-label="Main navigation" className="mt-6 flex flex-col gap-1">
            {NAV.map(({ to, en, hi, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition ${
                    isActive ? 'bg-primary text-on-primary shadow-card' : 'text-on-surface-variant hover:bg-primary/5'
                  }`
                }
              >
                <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
                <span>
                  {en} <span className="font-medium opacity-80">/ {hi}</span>
                </span>
              </NavLink>
            ))}
          </nav>
          <NavLink
            to="/login"
            className="mt-auto flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            <User size={20} strokeWidth={2.5} aria-hidden="true" />
            Sign in / roles
          </NavLink>
        </aside>

        <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col">
          <TopBar />
          <NetworkBanner />
          {/* Keyed on the route so each screen replays its entrance animation. */}
          <main key={pathname} className="cc-screen flex-1 px-5 pb-6 pt-5 lg:px-12 lg:pt-8">
            <div className="mx-auto w-full lg:max-w-[1400px]">
              <Outlet />
            </div>
          </main>
          <BottomNav />
        </div>
      </div>

      <Toast />
      <DemoGuide />
    </div>
  )
}
