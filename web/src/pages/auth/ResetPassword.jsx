import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import { CircleCheck } from 'lucide-react'
import {
  AuthButton,
  AuthField,
  AuthNotice,
  AuthShell,
  LockSolid,
  linkClass,
} from '../../components/auth/AuthShell.jsx'
import { api } from '../../lib/api.js'
import { checkPassword } from '../../lib/authRules.js'

// Tujuan tautan di email reset: APP_URL/reset-password?token=… (API_SPECS §4).
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [form, setForm] = useState({ password: '', ulang: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(token ? null : 'Tautan reset tidak lengkap. Minta tautan baru lewat Lupa password.')
  const [done, setDone] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    const invalid = checkPassword(form.password, 'Password baru')
    if (invalid) return setError(invalid)
    if (form.password !== form.ulang) return setError('Kedua password belum sama.')
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/auth/reset', { token, password: form.password })
      setDone(res?.message || 'Password berhasil diganti. Silakan masuk dengan password baru.')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Password baru" subtitle="Buat password baru untuk akunmu, minimal 8 karakter.">
      {done ? (
        <div className="mt-7 flex flex-col gap-6">
          <AuthNotice icon={CircleCheck} title="Password diganti">
            {done}
          </AuthNotice>
          <Link
            to="/masuk"
            replace
            className="flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-login-button px-6 font-semibold text-white"
          >
            Masuk
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col">
          <div className="flex flex-col gap-4">
            <AuthField
              icon={LockSolid}
              label="Password baru"
              reveal
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              disabled={!token}
            />
            <AuthField
              icon={LockSolid}
              label="Ulangi password"
              reveal
              autoComplete="new-password"
              value={form.ulang}
              onChange={set('ulang')}
              disabled={!token}
            />
          </div>
          {error && <ErrorBanner error={error} className="mt-3" />}
          <AuthButton busy={busy} disabled={busy || !token} className="mt-6">
            Simpan password
          </AuthButton>
          {!token && (
            <Link to="/lupa-password" className={`${linkClass} mx-auto mt-4 inline-flex min-h-touch items-center`}>
              Minta tautan baru
            </Link>
          )}
        </form>
      )}
    </AuthShell>
  )
}
