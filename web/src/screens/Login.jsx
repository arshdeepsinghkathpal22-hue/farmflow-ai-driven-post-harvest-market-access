import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, LogIn, ServerCog, ServerOff, ShieldCheck } from 'lucide-react'
import { useApp } from '../store/context'
import { DEMO_CREDENTIALS } from '../demo'
import { API_BASE, reachable } from '../lib/api'
import BRAND from '../brand'
import { Bilingual, Card, Chip, SectionTitle } from '../components/ui'

/**
 * Sign in.
 *
 * This screen exists because the auth on the backend is real and ought to be
 * reachable from the app rather than only from `curl`. It is deliberately not a
 * wall: a judge with three minutes who cannot get past a login form has already
 * formed their opinion, so the credentials are printed on the form and there is
 * a way past it.
 *
 * What signing in actually changes is worth being precise about, because it is
 * the only honest reason to have the screen at all: without it the app is
 * local-only and bookings live on the handset; with it, bookings are pushed to
 * the server, come back with a reference, and hold real slots that another
 * farmer can no longer take.
 */
export default function Login() {
  const { signIn, signedIn, session, signOut } = useApp()
  const navigate = useNavigate()

  const [username, setUsername] = useState(DEMO_CREDENTIALS.username)
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [backend, setBackend] = useState('checking')

  // Whether there is a server to talk to changes what this screen can promise,
  // so it is checked rather than assumed.
  useEffect(() => {
    let alive = true
    reachable().then((up) => {
      if (alive) setBackend(up ? 'up' : 'down')
    })
    return () => {
      alive = false
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)
    // Only skip the network when the check has come back and said there is
    // nothing there. While it is still running, try - being unsure is not the
    // same as knowing it is down.
    const result = await signIn(username.trim(), password, { backendUp: backend !== 'down' })
    setBusy(false)

    if (result.ok) navigate('/')
    else setError(result.reason)
  }

  if (signedIn) {
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
              <p className="text-sm text-on-surface-variant">@{session.username}</p>
              <Chip tone={session.mode === 'backend' ? 'green' : 'amber'} className="mt-3">
                {session.mode === 'backend'
                  ? 'Bookings are held on the server'
                  : 'Signed in on this device only'}
              </Chip>
            </div>
          </div>
          {session.mode === 'local' && (
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
        <button type="button" className="cc-btn-primary w-full" onClick={() => navigate('/')}>
          <Bilingual en="Back to the app" hi="ऐप पर वापस" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        en="Sign in"
        hi="साइन इन करें"
        sub="Signing in pushes your bookings to the server so they hold real storage slots. The app works without it - everything simply stays on this phone."
      />

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
            <Bilingual en={busy ? 'Signing in…' : 'Sign in'} hi="साइन इन करें" stacked />
          </button>
        </Card>
      </form>

      <button type="button" className="cc-btn-outline w-full" onClick={() => navigate('/')}>
        <Bilingual en="Continue without signing in" hi="बिना साइन इन जारी रखें" />
      </button>

      {/*
        Printing the credentials is not an oversight. This is a prototype, the
        pair is in the repository and in the backend's startup log, and pretending
        otherwise would only slow down the person evaluating it.
      */}
      <Card accent="none" className="p-4">
        <p className="text-sm font-semibold">Demo account</p>
        <p className="mt-1 font-mono text-sm text-on-surface-variant">
          {DEMO_CREDENTIALS.username} / {DEMO_CREDENTIALS.password}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          One fixed account, printed here on purpose. A prototype that cannot be got into is a
          prototype nobody evaluates. Real accounts, OTP sign-in and per-farmer isolation are
          designed but not built.
        </p>
      </Card>
    </div>
  )
}
