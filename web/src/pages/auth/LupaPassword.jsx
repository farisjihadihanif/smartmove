import { useState } from 'react'
import { Link } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import { MailCheck } from 'lucide-react'
import {
  AuthButton,
  AuthField,
  AuthFooter,
  AuthNotice,
  AuthShell,
  MailSolid,
  linkClass,
} from '../../components/auth/AuthShell.jsx'
import { api } from '../../lib/api.js'
import { EMAIL_RE } from '../../lib/authRules.js'
import { tr } from '../../lib/i18n.js'

// Lupa password: kirim tautan reset ke email (API_SPECS §4).
export default function LupaPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setError(tr('Format email belum benar.'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/auth/forgot', { email: value })
      setSent({ to: value, message: res?.message || tr('Tautan reset password sudah dikirim. Cek kotak masuk email kamu.') })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={tr('Lupa password')}
      subtitle={tr('Masukkan email akunmu. Kami kirim tautan untuk membuat password baru.')}
      back="/masuk"
    >
      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col">
        <AuthField
          icon={MailSolid}
          label={tr('Email')}
          placeholder={tr('nama@email.com')}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <ErrorBanner error={error} className="mt-3" />}
        {sent && (
          <div className="mt-4">
            <AuthNotice icon={MailCheck} title={tr('Cek kotak masuk')} detail={sent.to}>
              {sent.message}
            </AuthNotice>
          </div>
        )}
        <AuthButton busy={busy} className="mt-6">
          {sent ? tr('Kirim ulang tautan') : tr('Kirim tautan')}
        </AuthButton>
      </form>

      <AuthFooter>
        {tr('Sudah ingat?')}{' '}
        <Link to="/masuk" className={`${linkClass} inline-flex min-h-touch items-center px-1`}>
          {tr('Kembali ke Masuk')}
        </Link>
      </AuthFooter>
    </AuthShell>
  )
}
