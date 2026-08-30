/**
 * Whether this browser has been through the front door once.
 *
 * The very first open lands on the sign-in screen with its three role doors;
 * signing in - or explicitly continuing without - marks the entry, and from
 * then on the app opens straight into the right console. Kept out of the React
 * state on purpose: it is a property of the browser, not of a session.
 */
export const ENTRY_KEY = 'farmflow.entry.v1'

export function hasEntered() {
  try {
    return Boolean(localStorage.getItem(ENTRY_KEY))
  } catch {
    // Storage blocked (private mode): gating every open would be worse than
    // gating none, so the door counts as already opened.
    return true
  }
}

export function markEntered() {
  try {
    localStorage.setItem(ENTRY_KEY, '1')
  } catch {
    /* the gate simply asks again next time */
  }
}
