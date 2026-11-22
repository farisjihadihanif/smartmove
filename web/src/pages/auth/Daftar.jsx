import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import {
  AuthButton,
  AuthField,
  AuthFooter,
  AuthShell,
  BadgeSolid,
  LockSolid,
  MailSolid,
  PersonSolid,
  linkClass,
} from '../../components/auth/AuthShell.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.js'
import { checkRegister } from '../../lib/authRules.js'
import { tr } from '../../lib/i18n.js'

// Daftar akun: gaya sama dengan Member Login (mockup hal. 2).
export default function Daftar() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ namaLengkap: '', username: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    const body = {
      namaLengkap: form.namaLengkap.trim(),
      username: form.username.trim().toLowerCase(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
    }
    const invalid = checkRegister(body)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/auth/register', body)
      signIn(res)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={tr('Buat akun')}
      subtitle={tr('Simpan rencana perjalanan, kumpulkan poin, dan pesan tiket simulasi.')}
      back="/masuk"
    >
      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col">
        <div className="flex flex-col gap-4">
          <AuthField
            icon={BadgeSolid}
            label={tr('Nama lengkap')}
            placeholder={tr('mis. Budi Siregar')}
            autoComplete="name"
            value={form.namaLengkap}
            onChange={set('namaLengkap')}
          />
          <AuthField
            icon={PersonSolid}
            label={tr('Username')}
            placeholder={tr('mis. budi_medan')}
            hint={tr('Huruf kecil, angka, titik, atau garis bawah.')}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.username}
            onChange={set('username')}
          />
          <AuthField
            icon={MailSolid}
            label={tr('Email')}
            placeholder={tr('nama@email.com')}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
          />
          <AuthField
            icon={LockSolid}
            label={tr('Password')}
            hint={tr('Minimal 8 karakter.')}
            reveal
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
        </div>

        {error && <ErrorBanner error={error} className="mt-3" />}

        <AuthButton busy={busy} className="mt-6">
          {tr('Buat akun')}
        </AuthButton>
      </form>

      <AuthFooter>
        {tr('Sudah punya akun?')}{' '}
        <Link to="/masuk" state={location.state} className={`${linkClass} inline-flex min-h-touch items-center px-1`}>
          {tr('Masuk')}
        </Link>
      </AuthFooter>
    </AuthShell>
  )
}
