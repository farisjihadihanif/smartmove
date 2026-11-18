import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/** `{ user, status: 'memuat'|'tamu'|'masuk', signIn(res), signOut() }` dari AuthProvider. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
