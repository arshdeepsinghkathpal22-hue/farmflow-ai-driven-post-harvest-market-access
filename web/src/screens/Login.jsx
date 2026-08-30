import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, LogIn, ServerCog, ServerOff, ShieldCheck, Snowflake, Tractor, Truck } from 'lucide-react'
import { useApp } from '../store/context'
import { ROLE_CREDENTIALS } from '../demo'
import { API_BASE, reachable } from '../lib/api'
import BRAND from '../brand'
import { markEntered } from '../lib/entry'
import { Bilingual, Card, Chip, SectionTitle } from '../components/ui'

/**
 * Sign in - the front door for all three roles.
 *
 * One screen, three doors: farmer, storage owner, transporter. Each role has
 * its own printed demo account. The farmer's pair is checked by the real
 * backend when one is answering; the owner and transporter consoles are
 * device-local demo surfaces and the session says so.
 *
 * It is deliberately not a wall: a judge with three minutes who cannot get
 * past a login form has already formed their opinion, so the credentials are
 * printed on the form and there is a way past it.
 */
const ROLES = [
  { id: 'farmer', icon: Tractor, home: '/' },
  { id: 'owner', icon: Snowflake, home: '/owner' },
  { id: 'transporter', icon: Truck, home: '/transport' },
]

export default function Login() {
  const { signIn, signedIn, session, signOut } = useApp()
  const navigate = useNavigate()

  const [role, setRole] = useState('farmer')
  const [username, setUsername] = useState(ROLE_CREDENTIALS.farmer.username)
  const [password, setPassword] = useState(ROLE_CREDENTIALS.farmer.password)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [backend, setBackend] = useState('checking')

  // Whether there is a server to talk to changes what this screen can promise,
  // so it is checked rather than assumed. Only the farmer path uses it.
  useEffect(() => {
    let alive = true
    reachable().then((up) => {
      if (alive) setBackend(up ? 'up' : 'down')
    })
    return () => {
      alive = false
    }
  }, [])

  const pickRole = (id) => {
    setRole(id)
    setError(null)
    setUsername(ROLE_CREDENTIALS[id].username)
    setPassword(ROLE_CREDENTIALS[id].password)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)
    const result = await signIn(username.trim(), password, {
      backendUp: backend !== 'down',
      role,
    })
    setBusy(false)

    if (result.ok) {
      markEntered()
      navigate(ROLES.find((r) => r.id === role)?.home ?? '/')
    } else {
      setError(result.reason)
    }
  }

  if (signedIn) {
    const home = ROLES.find((r) => r.id === (session.role ?? 'farmer'))?.home ?? '/'
    return (
      <div className="space-y-5">
        <SectionTitle en="Signed in" hi="साइन इन" sub={`You are signed in to ${BRAND.name}.`} />
        <Card accent="green" className="p-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
              <ShieldCheck size={24} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight">{session.name}</h2>
              <p className="text-sm text-on-surface-variant">
                @{session.username} · {ROLE_CREDENTIALS[session.role ?? 'farmer'].label}
              </p>
              <Chip tone={session.mode === 'backend' ? 'green' : 'amber'} className="mt-3">
                {session.mode === 'backend'
                  ? 'Bookings are held on the server'
                  : 'Signed in on this device only'}
              </Chip>
            </div>
          </div>
          {session.mode === 'local' && session.role === 'farmer' && (
            <p className="mt-4 rounded-sm bg-secondary-fixed px-4 py-3 text-sm leading-relaxed text-on-secondary-container">
              There was no backend answering when you signed in, so this session was created on the
              handset. Everything works, but bookings are not holding real slots anywhere. Start the
              backend and sign in again to change that.
            </p>
          )}
        </Card>

        <button type="button" className="cc-btn-outline w-full" onClick={signOut}>
          <Bilingual en="Sign out" hi="साइन आउट" />
        </button>
        <button type="button" className="cc-btn-primary w-full" onClick={() => navigate(home)}>
          <Bilingual en="Back to the app" hi="ऐप पर वापस" />
        </button>
      </div>
    )
  }

  const roleMeta = ROLE_CREDENTIALS[role]

  return (
    <div className="lg:grid lg:grid-cols-[0.85fr,1.15fr] lg:items-stretch lg:gap-8">
      {/* Desktop only: the brand panel that keeps the form from floating
          alone in the middle of a monitor. */}
      <div className="hidden rounded-md bg-primary p-8 text-on-primary lg:flex lg:flex-col">
        <p className="text-3xl font-extrabold tracking-tight">{BRAND.name}</p>
        <p className="mt-3 text-base leading-relaxed text-on-primary/85">
          Post-harvest decisions, shared cold storage and market access for small farmers - on an
          ordinary phone, in the farmer's own language, working with or without signal.
        </p>
        <ul className="mt-8 space-y-5 text-sm leading-relaxed">
          <li className="flex gap-3">
            <Tractor size={22} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="block text-base">Farmers</strong> speak a booking, photograph a lot
              for freshness, pool a truck with neighbours.
            </span>
          </li>
          <li className="flex gap-3">
            <Snowflake size={22} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="block text-base">Storage owners</strong> see every micro-slot,
              coloured by the shelf life of the lot inside it.
            </span>
          </li>
          <li className="flex gap-3">
            <Truck size={22} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="block text-base">Transporters</strong> get priced pickup jobs,
              nearest first - theirs to accept or decline.
            </span>
          </li>
        </ul>
        <p className="mt-auto pt-8 text-xs text-on-primary/70">
          Prototype for Smart India Hackathon 2026 · everything below runs on-device unless a
          backend is answering.
        </p>
      </div>

      <div className="space-y-5">
      <SectionTitle
        en={`Welcome to ${BRAND.name}`}
        hi="साइन इन करें"
        sub="Choose who you are. Each role opens its own console - farmers book and sell, storage owners run the facility, transporters pick up the lots."
      />

      {/* The three doors. Farmer is preselected because it is the main flow. */}
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Sign in as">
        {ROLES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={role === id}
            onClick={() => pickRole(id)}
            className={`cc-chip flex-col !gap-1.5 !rounded-md !px-2 !py-4 text-center text-sm font-semibold ${
              role === id ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <Icon size={26} strokeWidth={2.4} aria-hidden="true" />
            <span className="leading-tight">
              {ROLE_CREDENTIALS[id].label}
              <span className="block text-[11px] font-medium opacity-90">{ROLE_CREDENTIALS[id].labelHi}</span>
            </span>
          </button>
        ))}
      </div>

      {role === 'farmer' ? (
        <Card accent={backend === 'up' ? 'green' : 'amber'} className="p-4">
          <p className="flex items-center gap-2.5 text-sm font-semibold">
            {backend === 'up' ? (
              <ServerCog size={18} strokeWidth={2.5} className="text-primary" aria-hidden="true" />
            ) : (
              <ServerOff size={18} strokeWidth={2.5} className="text-secondary" aria-hidden="true" />
            )}
            {backend === 'checking' && 'Looking for the backend…'}
            {backend === 'up' && `Backend is up at ${API_BASE}`}
            {backend === 'down' && 'No backend answering'}
          </p>
          {backend === 'down' && (
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              The demo credentials below will still sign you in on this device, which is how the
              deployed static build works. Bookings will not leave the phone.
            </p>
          )}
        </Card>
      ) : (
        <Card accent="blue" className="p-4">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            The {roleMeta.label.toLowerCase()} console is a device-local demo surface: the account
            below is validated on this handset, and the screen says so.
          </p>
        </Card>
      )}

      <form onSubmit={submit}>
        <Card accent="blue" className="p-5">
          <label htmlFor="cc-user" className="text-sm font-semibold">
            <Bilingual en="Username" hi="उपयोगकर्ता नाम" />
          </label>
          <input
            id="cc-user"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-2 w-full rounded-sm border-2 border-transparent bg-surface-container-low p-3 text-base text-on-surface focus:border-primary focus:outline-none"
          />

          <label htmlFor="cc-pass" className="mt-4 block text-sm font-semibold">
            <Bilingual en="Password" hi="पासवर्ड" />
          </label>
          <input
            id="cc-pass"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-sm border-2 border-transparent bg-surface-container-low p-3 text-base text-on-surface focus:border-primary focus:outline-none"
          />

          {error && (
            <p className="mt-4 flex items-start gap-2.5 rounded-sm bg-error-container px-4 py-3 text-sm leading-relaxed text-on-error-container">
              <AlertTriangle size={18} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button type="submit" className="cc-btn-primary mt-5 w-full !py-5" disabled={busy}>
            <LogIn size={22} strokeWidth={2.5} aria-hidden="true" />
            <Bilingual
              en={busy ? 'Signing in…' : `Sign in as ${roleMeta.label}`}
              hi="साइन इन करें"
              stacked
            />
          </button>
        </Card>
      </form>

      <button
        type="button"
        className="cc-btn-outline w-full"
        onClick={() => {
          markEntered()
          navigate('/')
        }}
      >
        <Bilingual en="Continue without signing in" hi="बिना साइन इन जारी रखें" />
      </button>

      {/*
        Printing the credentials is not an oversight. This is a prototype, the
        pairs are in the repository, and pretending otherwise would only slow
        down the person evaluating it.
      */}
      <Card accent="none" className="p-4">
        <p className="text-sm font-semibold">Demo accounts</p>
        <p className="mt-1 font-mono text-sm text-on-surface-variant">
          farmer / farmflow · owner / farmflow · driver / farmflow
        </p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          One fixed account per role, printed here on purpose. A prototype that cannot be got into
          is a prototype nobody evaluates. Real accounts, OTP sign-in and per-user isolation are
          designed but not built.
        </p>
      </Card>
      </div>
    </div>
  )
}
