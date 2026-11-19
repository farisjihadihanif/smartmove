import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { api, setUnauthorizedHandler } from './api.js'
import { AuthContext, useAuth } from './useAuth.js'

// Sesi web: cookie httpOnly di-set API; di sini cukup simpan data pengguna dari /auth/me.

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('memuat') // memuat | tamu | masuk

  const applyUser = useCallback((u) => {
    setUser(u || null)
    setStatus(u ? 'masuk' : 'tamu')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => applyUser(null))
    const ctrl = new AbortController()
    api
      .get('/auth/me', { signal: ctrl.signal })
      .then((d) => applyUser(d?.user))
      .catch((e) => {
        if (e.name !== 'AbortError') applyUser(null)
      })
    return () => {
      ctrl.abort()
      setUnauthorizedHandler(null)
    }
  }, [applyUser])

  const value = useMemo(
    () => ({
      user,
      status,
      /** Simpan sesi dari respons login/register `{user, token}`. */
      signIn: (res) => applyUser(res?.user),
      /** Ganti data pengguna setelah ubah profil / foto / password (`{user}`). */
      updateUser: (u) => applyUser(u),
      signOut: async () => {
        try {
          await api.post('/auth/logout')
        } finally {
          applyUser(null)
        }
      },
    }),
    [user, status, applyUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Layar khusus tamu (Masuk, Daftar, Lupa password): pengguna yang sudah masuk diarahkan ke Beranda. */
export function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'memuat') return <div className="min-h-dvh bg-login" aria-busy="true" />
  if (status === 'masuk') return <Navigate to={location.state?.from || '/'} replace />
  return <Outlet />
}

/** Layar khusus pengguna masuk: tamu diarahkan ke /masuk lalu kembali ke sini. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'memuat') return <div className="min-h-dvh bg-surface" aria-busy="true" />
  if (status === 'tamu') return <Navigate to="/masuk" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Dasbor admin: tamu → /masuk; pengguna biasa → pesan tanpa akses (peran dicek lagi di API). */
export function RequireAdmin() {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'memuat') return <div className="min-h-dvh bg-surface" aria-busy="true" />
  if (status === 'tamu') return <Navigate to="/masuk" replace state={{ from: location.pathname + location.search }} />
  if (user?.role !== 'admin') {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
        <div>
          <h1 className="font-serif text-2xl">Khusus pengelola</h1>
          <p className="mt-2 text-[15px] text-ink/70">Akunmu tidak punya akses ke dasbor admin.</p>
          <a href="/" className="mt-5 inline-flex min-h-touch items-center rounded-full bg-login-button px-6 font-semibold text-white">
            Kembali ke Beranda
          </a>
        </div>
      </main>
    )
  }
  return <Outlet />
}
