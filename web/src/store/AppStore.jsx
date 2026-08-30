import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CURRENT_LOT, FARMER, GROUP_POOL } from '../data/seed'
import { DEFAULT_LANGUAGE, getLanguage } from '../i18n/languages'
import { DEMO_CREDENTIALS, ROLE_CREDENTIALS } from '../demo'
import { spoilage } from '../lib/ai'
import { addDays } from '../lib/format'
import { ApiError, api, reachable, setToken } from '../lib/api'
import { newClientKey, pushBookings } from '../lib/sync'
import BRAND from '../brand'
import { AppContext } from './context'

const STORAGE_KEY = 'farmflow.state.v1'
const SESSION_KEY = 'farmflow.session.v1'

/** How long to wait before retrying a booking that failed for a transient reason. */
const RETRY_AFTER_MS = 5000

const emptyState = {
  bookings: [],
  joinedPools: [],
  purchases: [],
  // Buyer cart: [{ lotId, kg }]. Orders: what checkout produced.
  cart: [],
  orders: [],
  // Lots the farmer has listed for sale: [{ id, cropId, kg, pricePerKg, at }]
  sales: [],
  // Transporter decisions, keyed by job id: 'ACCEPTED' | 'DECLINED'
  transportJobs: {},
  scans: [],
  seq: 9821,
  guideSeen: false,
  // Drives the guide, the recommendation wording and - most importantly - the
  // language the microphone listens in.
  language: DEFAULT_LANGUAGE,
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw)
    return { ...emptyState, ...parsed }
  } catch {
    // Corrupt or unavailable storage should never block the demo.
    return emptyState
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* private browsing; the session simply stays in memory */
  }
}

export function AppStoreProvider({ children }) {
  const [state, setState] = useState(loadState)
  const [session, setSession] = useState(loadSession)
  const [toast, setToast] = useState(null)

  // Receipt numbers are handed back to the caller so it can navigate straight
  // to the new receipt. React defers state updaters, so the sequence lives in
  // a ref and is advanced synchronously rather than read out of `setState`.
  const seqRef = useRef(state.seq)

  // Read inside the memoised actions and the sync loop, which must not depend
  // on render state. Assigned during render, below.
  const onlineRef = useRef(true)
  const bookingsRef = useRef(state.bookings)
  const sessionRef = useRef(session)

  // Shown once per browser; the Profile tab can bring it back for a demo.
  const [guideOpen, setGuideOpen] = useState(() => !state.guideSeen)

  // Connectivity. `demoOffline` lets the story be told indoors, on wifi.
  const [netOnline, setNetOnline] = useState(() => navigator.onLine !== false)
  const [demoOffline, setDemoOffline] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // Bumped to ask the sync loop to try again after a transient failure. Without
  // it, a queue that failed to drain would sit there: the queued count has not
  // changed, so nothing else would re-trigger the effect.
  const [syncTick, setSyncTick] = useState(0)
  const online = netOnline && !demoOffline

  useEffect(() => {
    const up = () => setNetOnline(true)
    const down = () => setNetOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  onlineRef.current = online
  bookingsRef.current = state.bookings
  sessionRef.current = session

  const queuedCount = state.bookings.filter((b) => b.status === 'QUEUED').length

  /**
   * Drain the queue.
   *
   * Signed in with a backend answering, this really posts. Otherwise it
   * completes the bookings locally after a beat - which is not a cheat, it is
   * the only correct behaviour for the standalone build that ships to GitHub
   * Pages with no server behind it at all.
   */
  useEffect(() => {
    if (!online || queuedCount === 0) return undefined

    let cancelled = false
    let retryTimer = null
    setSyncing(true)

    const finish = (message) => {
      if (cancelled) return
      setSyncing(false)
      if (message) setToast({ message, tone: 'success' })
    }

    const run = async () => {
      const queued = bookingsRef.current.filter((b) => b.status === 'QUEUED')
      if (queued.length === 0) return finish(null)

      const live = sessionRef.current?.mode === 'backend' && (await reachable())
      if (cancelled) return

      if (!live) {
        await new Promise((resolve) => {
          retryTimer = setTimeout(resolve, 1200)
        })
        if (cancelled) return
        const at = new Date().toISOString()
        setState((prev) => ({
          ...prev,
          bookings: prev.bookings.map((b) =>
            b.status === 'QUEUED' ? { ...b, status: 'CONFIRMED', syncedAt: at } : b,
          ),
        }))
        return finish(
          `${queued.length} booking${queued.length > 1 ? 's' : ''} synced / सिंक हो गया`,
        )
      }

      const results = await pushBookings(queued)
      if (cancelled) return

      const byId = new Map(results.map((r) => [r.id, r]))
      const at = new Date().toISOString()

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => {
          const r = byId.get(b.id)
          if (!r) return b
          if (r.ok) {
            return {
              ...b,
              status: 'CONFIRMED',
              serverRef: r.reference,
              slotsHeld: r.slotsHeld,
              syncedAt: at,
              syncError: undefined,
            }
          }
          // The server understood and refused - the facility is full, the lot
          // is under its minimum. Retrying will not change the answer, so say
          // so rather than spinning.
          if (r.permanent) return { ...b, status: 'REJECTED', syncError: r.reason }
          // Anything else is the network. Stay queued and come back to it.
          return { ...b, syncError: r.reason }
        }),
      }))

      const sent = results.filter((r) => r.ok).length
      const refused = results.filter((r) => !r.ok && r.permanent)
      const transient = results.filter((r) => !r.ok && !r.permanent).length

      if (refused.length > 0) {
        setToast({ message: refused[0].reason, tone: 'error' })
      }
      if (transient > 0) {
        retryTimer = setTimeout(() => setSyncTick((t) => t + 1), RETRY_AFTER_MS)
      }
      finish(sent > 0 ? `${sent} booking${sent > 1 ? 's' : ''} on the server / सर्वर पर` : null)
    }

    run()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [online, queuedCount, syncTick])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage full or blocked - the session simply stays in memory */
    }
  }, [state])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  /**
   * Sign in.
   *
   * Tries the backend first. If there is no backend to try - no configured
   * base, or nothing listening - the documented demo credentials are accepted
   * on the device and the session is marked `local`, which is what stops the
   * sync loop from pretending it has a server to talk to. A wrong password
   * against a live backend is a real failure and is reported as one.
   */
  const signIn = useCallback(async (username, password, { backendUp, role = 'farmer' } = {}) => {
    // Owner and transporter consoles are device-local demo surfaces: their
    // credentials are validated on the handset, the session says which role it
    // carries, and nothing about the farmer's real backend path changes.
    if (role !== 'farmer') {
      const want = ROLE_CREDENTIALS[role]
      if (want && username === want.username && password === want.password) {
        const next = { mode: 'local', role, name: want.label, username }
        saveSession(next)
        setSession(next)
        setToast({ message: `Signed in as ${want.label}`, tone: 'success' })
        return { ok: true, mode: 'local', role }
      }
      return { ok: false, reason: `Those are not the ${role} demo credentials.` }
    }

    // The login screen has already asked whether anything is listening. When
    // the answer was no, attempting it anyway just makes the farmer watch a
    // spinner count out a doomed connection - and on the deployed static build
    // the answer is always no.
    const worthTrying = backendUp !== false

    try {
      if (!worthTrying) throw new ApiError(0, 'No backend answering.')
      const out = await api.login(username, password)
      setToken(out.token)
      const next = {
        mode: 'backend',
        role: 'farmer',
        farmerId: out.farmer.id,
        name: out.farmer.name,
        username: out.farmer.username,
      }
      saveSession(next)
      setSession(next)
      setToast({ message: `Signed in as ${out.farmer.name}`, tone: 'success' })
      return { ok: true, mode: 'backend' }
    } catch (error) {
      const reachedServer = Boolean(error?.status)
      if (
        !reachedServer &&
        username === DEMO_CREDENTIALS.username &&
        password === DEMO_CREDENTIALS.password
      ) {
        const next = { mode: 'local', role: 'farmer', farmerId: FARMER.id, name: FARMER.name, username }
        saveSession(next)
        setSession(next)
        setToast({ message: 'Signed in on this device', tone: 'success' })
        return { ok: true, mode: 'local' }
      }
      return {
        ok: false,
        reason: reachedServer
          ? error.detail || error.message
          : 'Those are not the demo credentials, and there is no server to ask.',
      }
    }
  }, [])

  const signOut = useCallback(() => {
    setToken('')
    saveSession(null)
    setSession(null)
    setToast({ message: 'Signed out', tone: 'success' })
  }, [])

  const actions = useMemo(
    () => ({
      notify: (message, tone = 'success') => setToast({ message, tone }),

      openGuide: () => setGuideOpen(true),

      setLanguage: (id) => setState((prev) => ({ ...prev, language: id })),

      recordScan: (scan) =>
        setState((prev) => ({ ...prev, scans: [{ ...scan, at: new Date().toISOString() }, ...prev.scans].slice(0, 30) })),

      toggleDemoOffline: () => setDemoOffline((v) => !v),

      closeGuide: () => {
        setGuideOpen(false)
        setState((prev) => (prev.guideSeen ? prev : { ...prev, guideSeen: true }))
      },

      createBooking: ({
        cropId,
        quantityKg,
        storageId,
        pickup,
        // Days from now the produce actually arrives: 0 today, 1 tomorrow,
        // 2 day-after. The voice parser already knew this (`dayOffset`) and it
        // was being thrown away - so a farmer who said "kal" got a receipt
        // whose check-in date said today, and an expiry one day early.
        pickupOffset = 0,
        // The day id ('today' | 'tomorrow' | 'dayAfter') where one applies, so
        // the bookings list can name the day in the farmer's own language
        // instead of a frozen English label.
        pickupDayId = null,
        holdDays = 6,
        pooled = false,
      }) => {
        const seq = seqRef.current + 1
        seqRef.current = seq

        const now = new Date()
        const checkin = addDays(now, Math.min(60, Math.max(0, pickupOffset)))
        const { remaining } = spoilage(cropId, 0)
        const created = {
          id: `${BRAND.shortCode}-${seq}`,
          // Generated here rather than at send time, so a booking pushed twice
          // reserves the slot once. This is the whole retry-safety story.
          clientKey: newClientKey(),
          cropId,
          quantityKg,
          storageId,
          pickup,
          pickupDayId,
          pooled,
          holdDays,
          // Queued means "not yet acknowledged by anyone but this phone".
          // With no signal that is obviously true. Signed in against a live
          // backend it is also true until the server answers. Signed out with
          // a signal, there is nobody to acknowledge it and nothing to wait
          // for - claiming otherwise would put a "saved offline" badge on a
          // booking made in full signal, which is simply a lie.
          status:
            !onlineRef.current || sessionRef.current?.mode === 'backend'
              ? 'QUEUED'
              : 'CONFIRMED',
          createdAt: now.toISOString(),
          checkinAt: checkin.toISOString(),
          expiryAt: addDays(checkin, remaining).toISOString(),
        }

        setState((prev) => ({ ...prev, seq, bookings: [created, ...prev.bookings] }))
        return created
      },

      cancelBooking: (id) => {
        setState((prev) => ({
          ...prev,
          bookings: prev.bookings.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' } : b)),
        }))
        // Best effort, and only where the server knows about it. A cancellation
        // that fails to reach the backend still leaves the slot held, which is
        // a real gap and is named in the README rather than hidden here.
        const booking = bookingsRef.current.find((b) => b.id === id)
        if (booking?.serverRef && sessionRef.current?.mode === 'backend') {
          api.cancelBooking(booking.serverRef).catch(() => {})
        }
      },

      joinPool: (poolId) =>
        setState((prev) =>
          prev.joinedPools.includes(poolId)
            ? prev
            : { ...prev, joinedPools: [...prev.joinedPools, poolId] },
        ),

      leavePool: (poolId) =>
        setState((prev) => ({
          ...prev,
          joinedPools: prev.joinedPools.filter((p) => p !== poolId),
        })),

      buyLot: (lotId) =>
        setState((prev) =>
          prev.purchases.includes(lotId)
            ? prev
            : { ...prev, purchases: [...prev.purchases, lotId] },
        ),

      /** Put a lot in the cart, or change its quantity if already there. */
      addToCart: (lotId, kgStep) =>
        setState((prev) => {
          const existing = prev.cart.find((c) => c.lotId === lotId)
          if (existing) {
            return {
              ...prev,
              cart: prev.cart.map((c) => (c.lotId === lotId ? { ...c, kg: c.kg + kgStep } : c)),
            }
          }
          return { ...prev, cart: [...prev.cart, { lotId, kg: kgStep }] }
        }),

      setCartKg: (lotId, kg) =>
        setState((prev) => ({
          ...prev,
          cart:
            kg <= 0
              ? prev.cart.filter((c) => c.lotId !== lotId)
              : prev.cart.map((c) => (c.lotId === lotId ? { ...c, kg } : c)),
        })),

      clearCart: () => setState((prev) => ({ ...prev, cart: [] })),

      /** Turn the cart into an order. Returns the order so the screen can show it. */
      checkoutCart: (items, totalRupees) => {
        const order = {
          id: `ORD-${Date.now().toString(36).toUpperCase()}`,
          items,
          totalRupees,
          at: new Date().toISOString(),
        }
        setState((prev) => ({
          ...prev,
          cart: [],
          orders: [order, ...prev.orders],
          purchases: [...new Set([...prev.purchases, ...items.map((i) => i.lotId)])],
        }))
        return order
      },

      /** The farmer's own listing: how many kilograms, at today's price. */
      recordSale: ({ cropId, kg, pricePerKg }) => {
        const sale = {
          id: `SL-${Date.now().toString(36).toUpperCase()}`,
          cropId,
          kg,
          pricePerKg,
          at: new Date().toISOString(),
        }
        setState((prev) => ({ ...prev, sales: [sale, ...prev.sales] }))
        return sale
      },

      /** Transporter's accept / decline on a pickup job. */
      setTransportJob: (jobId, status) =>
        setState((prev) => ({
          ...prev,
          transportJobs: { ...prev.transportJobs, [jobId]: status },
        })),

      resetDemo: () => {
        seqRef.current = emptyState.seq
        setState(emptyState)

        // Clear the server as well, when there is one.
        //
        // A 450 kg lot takes eighteen of a facility's 180 micro-slots, so ten
        // demo runs fill it and the eleventh is correctly refused. Correct, and
        // a terrible thing to discover on stage - so the reset button resets
        // both halves. The endpoint only exists in development; anywhere else
        // this is a 404 and is ignored.
        api
          .resetDemo()
          .then(() => setToast({ message: 'Demo reset, slots freed / स्लॉट खाली', tone: 'success' }))
          .catch(() => setToast({ message: 'Demo data reset / डेमो रीसेट', tone: 'success' }))
      },
    }),
    [],
  )

  const value = useMemo(
    () => ({
      ...state,
      farmer: session ? { ...FARMER, name: session.name ?? FARMER.name } : FARMER,
      currentLot: CURRENT_LOT,
      pool: GROUP_POOL,
      hasJoinedPool: state.joinedPools.includes(GROUP_POOL.id),
      activeBookings: state.bookings.filter((b) => b.status !== 'CANCELLED'),
      lang: state.language ?? DEFAULT_LANGUAGE,
      langMeta: getLanguage(state.language ?? DEFAULT_LANGUAGE),
      toast,
      guideOpen,
      online,
      demoOffline,
      syncing,
      queuedCount,
      session,
      signedIn: Boolean(session),
      signIn,
      signOut,
      ...actions,
    }),
    [state, toast, guideOpen, online, demoOffline, syncing, queuedCount, session, signIn, signOut, actions],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
