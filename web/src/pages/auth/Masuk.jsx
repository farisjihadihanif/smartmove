import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import { AuthButton, AuthField, AuthShell, LockSolid, PersonSolid, linkClass } from '../../components/auth/AuthShell.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.js'

// Member Login (mockup hal. 2).
export default function Masuk() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '', ingat: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'ingat' ? e.target.checked : e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.username.trim() || !form.password) {
      setError('Isi username/email dan password dulu.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/auth/login', { ...form, username: form.username.trim() })
      signIn(res)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <AuthShell title="MEMBER LOGIN">
      <form onSubmit={onSubmit} noValidate className="mt-10 flex flex-col">
        <div className="flex flex-col gap-5">
          <AuthField
            icon={PersonSolid}
            label="Username atau email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.username}
            onChange={set('username')}
          />
          <AuthField
            icon={LockSolid}
            label="Password"
            reveal
            autoComplete="current-password"
            value={form.password}
            onChange={set('password')}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem]">
          <label className="-ml-2 flex min-h-touch cursor-pointer items-center gap-2.5 px-2 font-semibold">
            <input
              type="checkbox"
              checked={form.ingat}
              onChange={set('ingat')}
              className="size-4 accent-login-button"
            />
            Ingat saya
          </label>
          <Link to="/lupa-password" className={`${linkClass} -mr-2 flex min-h-touch items-center px-2`}>
            Lupa password?
          </Link>
        </div>

        {error && <ErrorBanner error={error} className="mt-3" />}

        <AuthButton busy={busy} className="mt-6">
          Masuk
        </AuthButton>
      </form>

      <div className="mt-auto flex flex-col items-center pt-12">
        <p className="text-[0.95rem] font-semibold">Belum punya akun?</p>
        <Link
          to="/daftar"
          state={location.state}
          className="mt-2 flex min-h-14 w-full max-w-72 items-center justify-center rounded-full border-2 border-login-button text-xl font-semibold transition hover:bg-white/10"
        >
          Buat akun
        </Link>
      </div>
    </AuthShell>
  )
}
