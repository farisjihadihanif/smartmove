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
      title="Buat akun"
      subtitle="Simpan rencana perjalanan, kumpulkan poin, dan pesan tiket simulasi."
      back="/masuk"
    >
      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col">
        <div className="flex flex-col gap-4">
          <AuthField
            icon={BadgeSolid}
            label="Nama lengkap"
            placeholder="mis. Budi Siregar"
            autoComplete="name"
            value={form.namaLengkap}
            onChange={set('namaLengkap')}
          />
          <AuthField
            icon={PersonSolid}
            label="Username"
            placeholder="mis. budi_medan"
            hint="Huruf kecil, angka, titik, atau garis bawah."
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.username}
            onChange={set('username')}
          />
          <AuthField
            icon={MailSolid}
            label="Email"
            placeholder="nama@email.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
          />
          <AuthField
            icon={LockSolid}
            label="Password"
            hint="Minimal 8 karakter."
            reveal
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
        </div>

        {error && <ErrorBanner error={error} className="mt-3" />}

        <AuthButton busy={busy} className="mt-6">
          Buat akun
        </AuthButton>
      </form>

      <AuthFooter>
        Sudah punya akun?{' '}
        <Link to="/masuk" state={location.state} className={`${linkClass} inline-flex min-h-touch items-center px-1`}>
          Masuk
        </Link>
      </AuthFooter>
    </AuthShell>
  )
}
