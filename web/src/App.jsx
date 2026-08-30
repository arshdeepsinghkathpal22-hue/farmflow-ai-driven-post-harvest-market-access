import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import { AppStoreProvider } from './store/AppStore'
import { useApp } from './store/context'
import FarmerLayout from './components/FarmerLayout'
import Home from './screens/Home'
import Login from './screens/Login'
import { hasEntered } from './lib/entry'

/**
 * Every screen past the front door is code-split.
 *
 * The first paint used to carry the owner console, the marketplace, the whole
 * voice screen and the QR library whether or not they were ever opened - on a
 * low-end phone over a slow link that was the difference between "opens" and
 * "still white". Now the shell ships first and each screen arrives when it is
 * actually navigated to.
 */
const VoiceBooking = lazy(() => import('./screens/VoiceBooking'))
const Advisor = lazy(() => import('./screens/Advisor'))
const FindStorage = lazy(() => import('./screens/FindStorage'))
const GroupBooking = lazy(() => import('./screens/GroupBooking'))
const Bookings = lazy(() => import('./screens/Bookings'))
const Receipt = lazy(() => import('./screens/Receipt'))
const Verify = lazy(() => import('./screens/Verify'))
const Guide = lazy(() => import('./screens/Guide'))
const Freshness = lazy(() => import('./screens/Freshness'))
const Marketplace = lazy(() => import('./screens/Marketplace'))
const Profile = lazy(() => import('./screens/Profile'))
const OwnerDashboard = lazy(() => import('./screens/OwnerDashboard'))
const TransporterHub = lazy(() => import('./screens/TransporterHub'))

/** Each route should open at the top, the way a native screen push does. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function ScreenFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-label="Loading">
      <span className="h-9 w-9 animate-spin rounded-full border-4 border-primary/25 border-t-primary" />
    </div>
  )
}

/**
 * The front door, once.
 *
 * On the very first open the app lands on the sign-in screen with its three
 * role doors. Signing in - or choosing to continue without - marks the entry,
 * and from then on every open goes straight to the right console: farmers to
 * the home screen, owners and transporters to theirs. Deep links are never
 * gated, so a shared receipt URL still opens.
 */
function EnterApp() {
  const { session } = useApp()
  const role = session?.role

  if (role === 'owner') return <Navigate to="/owner" replace />
  if (role === 'transporter') return <Navigate to="/transport" replace />
  if (!session && !hasEntered()) return <Navigate to="/login" replace />
  return <Home />
}

export default function App() {
  return (
    <AppStoreProvider>
      {/* HashRouter keeps deep links working on GitHub Pages without a server rewrite. */}
      <HashRouter>
        <ScrollToTop />
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route element={<FarmerLayout />}>
              <Route index element={<EnterApp />} />
              <Route path="voice" element={<VoiceBooking />} />
              <Route path="advisor" element={<Advisor />} />
              <Route path="storage" element={<FindStorage />} />
              <Route path="group" element={<GroupBooking />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="receipt/:id" element={<Receipt />} />
              <Route path="verify" element={<Verify />} />
              <Route path="guide" element={<Guide />} />
              <Route path="freshness" element={<Freshness />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="profile" element={<Profile />} />
              {/* Inside the layout on purpose: signing in is optional, so the
                  person must always be able to navigate away from it. */}
              <Route path="login" element={<Login />} />
            </Route>
            <Route path="/owner" element={<OwnerDashboard />} />
            <Route path="/transport" element={<TransporterHub />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AppStoreProvider>
  )
}
