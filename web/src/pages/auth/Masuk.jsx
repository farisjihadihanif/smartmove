import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import {
  AuthButton,
  AuthField,
  AuthSecondary,
  AuthShell,
  LockSolid,
  PersonSolid,
  linkClass,
} from '../../components/auth/AuthShell.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.js'
import { tr } from '../../lib/i18n.js'

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
      setError(tr('Isi username/email dan password dulu.'))
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
    <AuthShell title={tr('Member Login')} subtitle={tr('Masuk untuk melanjutkan rencana perjalananmu di Medan.')}>
      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col">
        <div className="flex flex-col gap-4">
          <AuthField
            icon={PersonSolid}
            label={tr('Username atau email')}
            placeholder={tr('mis. budi_medan')}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.username}
            onChange={set('username')}
          />
          <AuthField
            icon={LockSolid}
            label={tr('Password')}
            reveal
            autoComplete="current-password"
            value={form.password}
            onChange={set('password')}
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-3 text-[0.9rem]">
          <label className="-ml-2 flex min-h-touch cursor-pointer items-center gap-2.5 px-2 text-ink/80">
            <input
              type="checkbox"
              checked={form.ingat}
              onChange={set('ingat')}
              className="size-4 accent-login-button"
            />
            {tr('Ingat saya')}
          </label>
          <Link to="/lupa-password" className={`${linkClass} -mr-2 flex min-h-touch items-center px-2`}>
            {tr('Lupa password?')}
          </Link>
        </div>

        {error && <ErrorBanner error={error} className="mt-3" />}

        <AuthButton busy={busy} className="mt-4">
          {tr('Masuk')}
        </AuthButton>
      </form>

      <div className="mt-auto pt-10 lg:mt-8 lg:pt-0">
        <p className="mb-3 flex items-center gap-3 text-sm text-ink/55 before:h-px before:flex-1 before:bg-ink/10 after:h-px after:flex-1 after:bg-ink/10">
          {tr('Belum punya akun?')}
        </p>
        <AuthSecondary to="/daftar" state={location.state}>
          {tr('Buat akun')}
        </AuthSecondary>
      </div>
    </AuthShell>
  )
}
