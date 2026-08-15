import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppStoreProvider } from './store/AppStore'
import FarmerLayout from './components/FarmerLayout'
import Home from './screens/Home'
import VoiceBooking from './screens/VoiceBooking'
import Advisor from './screens/Advisor'
import FindStorage from './screens/FindStorage'
import GroupBooking from './screens/GroupBooking'
import Bookings from './screens/Bookings'
import Receipt from './screens/Receipt'
import Verify from './screens/Verify'
import Guide from './screens/Guide'
import Freshness from './screens/Freshness'
import Marketplace from './screens/Marketplace'
import Impact from './screens/Impact'
import Profile from './screens/Profile'
import Login from './screens/Login'
import OwnerDashboard from './screens/OwnerDashboard'

/** Each route should open at the top, the way a native screen push does. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <AppStoreProvider>
      {/* HashRouter keeps deep links working on GitHub Pages without a server rewrite. */}
      <HashRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<FarmerLayout />}>
            <Route index element={<Home />} />
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
            <Route path="impact" element={<Impact />} />
            <Route path="profile" element={<Profile />} />
            {/* Inside the layout on purpose: signing in is optional, so the
                farmer must always be able to navigate away from it. */}
            <Route path="login" element={<Login />} />
          </Route>
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppStoreProvider>
  )
}
