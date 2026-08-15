import { createContext, useContext } from 'react'

// Kept apart from the provider component so that editing either one does not
// break React Fast Refresh during development.
export const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppStoreProvider')
  return ctx
}
