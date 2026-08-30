/**
 * Backend client.
 *
 * The app is local-first by design: every action is written to local state
 * immediately and only then pushed to the API. That is not a fallback bolted on
 * afterwards, it is the point - a farmer standing in a field on patchy 2G
 * cannot wait for a round trip, and a demo should not die because a server is
 * asleep.
 *
 * So every call here is allowed to fail. `reachable()` decides whether the
 * backend is worth talking to; nothing above this module treats an unreachable
 * API as an error.
 */

const isLocalHost = (h) =>
  h === 'localhost' ||
  h === '127.0.0.1' ||
  h === '[::1]' ||
  /^192\.168\.\d+\.\d+$/.test(h) ||
  /^10\.\d+\.\d+\.\d+$/.test(h)

const DEFAULT_BASE =
  typeof window !== 'undefined' && isLocalHost(window.location.hostname)
    ? `http://${window.location.hostname}:8000`
    : ''

// Overridable at build time for a deployed API; empty means local-only mode.
export const API_BASE = (import.meta.env?.VITE_API_BASE ?? DEFAULT_BASE).replace(/\/$/, '')

const TOKEN_KEY = 'farmflow.token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private browsing; the session simply stays in memory */
  }
}

class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `Request failed (${status})`)
    this.status = status
    this.detail = detail
  }
}

async function request(path, { method = 'GET', body, auth = true, timeout = 6000 } = {}) {
  if (!API_BASE) throw new ApiError(0, 'No backend configured.')

  // Nothing is gained by sending a request that is certain to come back 401.
  // It costs a round trip, and it fills the console with authentication
  // failures that are not failures at all - the farmer simply has not signed
  // in, which is a supported way to use this app. Status 0 marks it as never
  // having reached the server, so the sync loop treats it as transient and the
  // booking stays queued rather than being marked refused.
  if (auth && !getToken()) throw new ApiError(0, 'Not signed in.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) : null

    if (!response.ok) {
      throw new ApiError(response.status, payload?.detail ?? response.statusText)
    }
    return payload
  } finally {
    clearTimeout(timer)
  }
}

/** Is the backend up and answering? Cheap, and never throws. */
export async function reachable() {
  if (!API_BASE) return false
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(2500),
    })
    return response.ok
  } catch {
    return false
  }
}

export const api = {
  // Short timeout on purpose. Somebody waiting on a sign-in button is watching
  // it, and a browser that has just had several connections refused will sit on
  // the next one for seconds before giving up. Three seconds is generous for a
  // server that is actually there.
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
      timeout: 3000,
    }),

  me: () => request('/api/me'),

  crops: () => request('/api/crops', { auth: false }),

  facilities: () => request('/api/facilities', { auth: false }),

  bookings: () => request('/api/bookings'),

  createBooking: (payload) => request('/api/bookings', { method: 'POST', body: payload }),

  cancelBooking: (reference) =>
    request(`/api/bookings/${encodeURIComponent(reference)}/cancel`, { method: 'POST' }),

  receipt: (reference) => request(`/api/bookings/${encodeURIComponent(reference)}/receipt`),

  // Short timeout on purpose: somebody is standing at a scanner holding a
  // receipt. If the server cannot answer quickly the offline check will, and
  // waiting six seconds to find that out is worse than the weaker answer.
  /** Live Agmarknet prices via the backend proxy; throws where unconfigured. */
  livePrices: (commodity, state = 'Uttar Pradesh') =>
    request(
      `/api/prices/live?commodity=${encodeURIComponent(commodity)}&state=${encodeURIComponent(state)}`,
      { auth: false, timeout: 7000 },
    ),

  verifyReceipt: (code) =>
    request('/api/receipts/verify', { method: 'POST', body: { code }, auth: false, timeout: 1500 }),

  publicKey: () => request('/api/receipts/public-key', { auth: false }),

  scans: () => request('/api/scans'),

  createScan: (payload) => request('/api/scans', { method: 'POST', body: payload }),

  // Development-only on the server; it simply 404s anywhere else.
  resetDemo: () => request('/api/demo/reset', { method: 'POST', auth: false }),
}

export { ApiError }
