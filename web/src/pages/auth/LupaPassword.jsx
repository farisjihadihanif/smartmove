import { useState } from 'react'
import { Link } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import { AuthButton, AuthField, AuthNotice, AuthShell, MailSolid, linkClass } from '../../components/auth/AuthShell.jsx'
import { api } from '../../lib/api.js'
import { EMAIL_RE } from '../../lib/authRules.js'

// Lupa password: kirim tautan reset ke email (API_SPECS §4).
export default function LupaPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setError('Format email belum benar.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/auth/forgot', { email: value })
      setSent(res?.message || 'Tautan reset password sudah dikirim. Cek kotak masuk email kamu.')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="LUPA PASSWORD">
      <p className="mt-3 text-center leading-relaxed text-white/90">
        Masukkan email akunmu. Kami kirim tautan untuk membuat password baru.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col">
        <AuthField
          icon={MailSolid}
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <ErrorBanner error={error} className="mt-3" />}
        {sent && (
          <div className="mt-4">
            <AuthNotice>{sent}</AuthNotice>
          </div>
        )}
        <AuthButton busy={busy} className="mt-6">
          {sent ? 'Kirim ulang tautan' : 'Kirim tautan'}
        </AuthButton>
      </form>

      <p className="mt-auto pt-10 text-center text-[0.95rem] font-semibold">
        Sudah ingat?{' '}
        <Link to="/masuk" className={`${linkClass} inline-flex min-h-touch items-center px-1`}>
          Kembali ke Masuk
        </Link>
      </p>
    </AuthShell>
  )
}
