/**
 * The demonstration account.
 *
 * These credentials are in the bundle on purpose. This is a prototype built to
 * be handed to a judge with three minutes and no patience, and a sign-in screen
 * that cannot be got past is worse than no sign-in screen at all. They are
 * printed on the login form itself, and they are the same pair the backend
 * prints at startup.
 *
 * Nothing about the real auth path depends on them: when the backend is
 * reachable the username and password are checked server side and a signed
 * token comes back. These only stand in when there is no backend to ask, which
 * is the case for the static build on GitHub Pages.
 */
export const DEMO_CREDENTIALS = {
  username: 'farmer',
  password: 'farmflow',
}
