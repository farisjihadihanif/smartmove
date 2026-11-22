import { useId, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Megaphone, Route, Ticket, TrafficCone } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../../assets/brand/logo.webp'
import { tr } from '../../lib/i18n.js'

// Fitur unggulan dari poster (mockup hal. 1) – tampil di panel kiri versi desktop.
const FITUR = [
  [Route, tr('Navigasi rute alternatif')],
  [TrafficCone, tr('Pemantau lalu lintas real time')],
  [Ticket, tr('Pembayaran terintegrasi transportasi umum')],
  [Megaphone, tr('Kampanye kesadaran transportasi umum')],
]

/**
 * Kerangka layar akun (identitas mockup hal. 2, dimodernkan):
 * - Ponsel: pita gradasi indigo → magenta bertekstur lilac di atas, lembar putih membulat
 *   yang menutupinya, dan medali avatar yang menumpang di sambungan keduanya.
 * - Desktop: dua kolom – panel gradasi (logo + fitur) di kiri, form di kanan.
 * `back`: tujuan tombol kembali di pita (opsional).
 */
export function AuthShell({ title, subtitle, back, children }) {
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="bg-login-wash relative px-6 pb-[5.5rem] pt-4 text-white lg:flex lg:min-h-dvh lg:flex-col lg:px-14 lg:pb-12 lg:pt-12 xl:px-20">
        <div className="flex min-h-touch items-center gap-3">
          {back && (
            <Link
              to={back}
              aria-label={tr('Kembali')}
              className="-ml-3 grid size-touch shrink-0 place-items-center rounded-full hover:bg-white/15"
            >
              <ArrowLeft size={22} aria-hidden="true" />
            </Link>
          )}
          <Brand />
        </div>

        <div className="hidden lg:mt-auto lg:block">
          <p className="max-w-[14ch] font-serif text-[clamp(2.5rem,3.6vw,3.5rem)] leading-[1.05]">
            {tr('Permudah kegiatanmu di Medan')}
          </p>
          <ul className="mt-10 max-w-md divide-y divide-white/20 border-y border-white/20">
            {FITUR.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-4 py-3.5 text-[0.975rem]">
                <Icon size={22} strokeWidth={1.75} className="shrink-0 text-white/90" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="relative -mt-9 flex min-h-[calc(100dvh-5.5rem)] flex-col rounded-t-[2rem] bg-surface px-6 pb-8 lg:mt-0 lg:min-h-dvh lg:justify-center lg:rounded-none lg:px-12 lg:py-12">
        <div className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col lg:flex-none">
          <div
            aria-hidden="true"
            className="mx-auto -mt-10 grid size-20 place-items-center rounded-full bg-login-avatar text-indigo ring-[6px] ring-surface lg:mx-0 lg:mt-0 lg:size-16 lg:ring-0"
          >
            <PersonSolid size={44} className="lg:size-9" />
          </div>
          <h1 className="mt-4 text-center font-serif text-[1.875rem] leading-tight text-ink lg:mt-6 lg:text-left lg:text-[2.25rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-2 max-w-[34ch] text-center text-[0.95rem] leading-relaxed text-ink/65 lg:mx-0 lg:text-left">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-2xl bg-white shadow-[0_4px_14px_rgb(20_10_60/0.25)]">
        <img src={logo} alt="" width="34" height="26" className="h-auto w-[34px]" />
      </span>
      <span className="font-serif text-xl leading-none">{tr('SmartMove Medan')}</span>
    </div>
  )
}

/**
 * Kolom isian: label di atas, lalu sel ikon + celah tipis + sel isian (motif mockup hal. 2)
 * berlatar `login-field`. Teks rata kiri agar isian panjang (email) tetap terbaca.
 */
export function AuthField({ icon: Icon, label, hint, type = 'text', reveal = false, ...props }) {
  const id = useId()
  const hintId = useId()
  const [shown, setShown] = useState(false)
  const inputType = reveal ? (shown ? 'text' : 'password') : type

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink/80">
        {label}
      </label>
      <div className="flex h-[3.25rem] gap-1 rounded-2xl outline-offset-2 outline-login-button focus-within:outline-2">
        <span aria-hidden="true" className="grid w-12 shrink-0 place-items-center rounded-l-2xl bg-login-field text-indigo">
          <Icon size={22} />
        </span>
        <div className="flex min-w-0 flex-1 items-center rounded-r-2xl bg-login-field">
          <input
            id={id}
            type={inputType}
            aria-describedby={hint ? hintId : undefined}
            className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-base font-medium text-indigo outline-none placeholder:font-normal placeholder:text-indigo/45 disabled:opacity-60"
            {...props}
          />
          {reveal && (
            <button
              type="button"
              onClick={() => setShown((v) => !v)}
              aria-label={shown ? tr('Sembunyikan password') : tr('Tampilkan password')}
              aria-pressed={shown}
              className="grid size-touch shrink-0 place-items-center rounded-full text-indigo/60 hover:text-indigo"
            >
              {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-[0.8125rem] leading-snug text-ink/55">
          {hint}
        </p>
      )}
    </div>
  )
}

const buttonBase =
  'flex min-h-[3.25rem] w-full items-center justify-center rounded-full px-6 text-base font-semibold transition'

/** Tombol utama ungu (mockup: "Login"). */
export function AuthButton({ busy, children, className = '', ...props }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy || undefined}
      className={`${buttonBase} bg-login-button text-white shadow-[0_6px_18px_-6px_rgb(115_36_169/0.7)] hover:brightness-110 active:scale-[0.99] disabled:opacity-70 ${className}`}
      {...props}
    >
      {busy ? tr('Tunggu sebentar…') : children}
    </button>
  )
}

/** Tombol kedua bergaris ungu (mockup: "Create account"), berupa tautan. */
export function AuthSecondary({ className = '', ...props }) {
  return (
    <Link
      className={`${buttonBase} border-2 border-login-button text-login-button hover:bg-login-button/5 ${className}`}
      {...props}
    />
  )
}

/** Pesan sukses (mis. email reset terkirim). `detail` ditebalkan dan boleh patah di mana saja (alamat email panjang). */
export function AuthNotice({ title, children, detail, icon: Icon }) {
  return (
    <div role="status" className="flex gap-3 rounded-2xl bg-login-field px-4 py-3.5 text-indigo">
      {Icon && <Icon size={22} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 text-sm leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        <p className="text-indigo/85">{children}</p>
        {detail && <p className="mt-1 font-semibold [overflow-wrap:anywhere]">{detail}</p>}
      </div>
    </div>
  )
}

/** Baris "Sudah punya akun? Masuk" di dasar lembar. */
export function AuthFooter({ children }) {
  return <p className="mt-auto pt-10 text-center text-[0.95rem] text-ink/70 lg:mt-10 lg:pt-0 lg:text-left">{children}</p>
}

export const linkClass =
  'font-semibold text-login-button underline decoration-login-button/35 underline-offset-4 hover:decoration-login-button'

// Ikon padat seperti di mockup (lucide hanya garis).
export function PersonSolid({ size = 24, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
      <circle cx="12" cy="7.2" r="4.6" />
      <path d="M3.4 20.2c.9-4.2 4.4-7 8.6-7s7.7 2.8 8.6 7c.1.6-.3 1.1-.9 1.1H4.3c-.6 0-1-.5-.9-1.1Z" />
    </svg>
  )
}

export function LockSolid({ size = 24, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
      <path d="M7.5 10V7.6a4.5 4.5 0 0 1 9 0V10h-2.2V7.6a2.3 2.3 0 0 0-4.6 0V10Z" />
      <rect x="4.5" y="9.5" width="15" height="12" rx="2.2" />
    </svg>
  )
}

export function MailSolid({ size = 24, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
      <path d="M4.5 5h15A2.5 2.5 0 0 1 22 7.5v.3l-10 6.1L2 7.8v-.3A2.5 2.5 0 0 1 4.5 5Z" />
      <path d="M2 10.1l9.5 5.8c.3.2.7.2 1 0l9.5-5.8v6.4A2.5 2.5 0 0 1 19.5 19h-15A2.5 2.5 0 0 1 2 16.5Z" />
    </svg>
  )
}

export function BadgeSolid({ size = 24, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-11A2.5 2.5 0 0 1 4.5 4ZM9 8a2.3 2.3 0 1 0 0 4.6A2.3 2.3 0 0 0 9 8Zm-4 8.3c.4-1.8 2-2.9 4-2.9s3.6 1.1 4 2.9c.1.4-.2.7-.6.7H5.6c-.4 0-.7-.3-.6-.7ZM14.5 9a.8.8 0 0 0 0 1.6h3.8a.8.8 0 0 0 0-1.6Zm0 3.4a.8.8 0 0 0 0 1.6h2.6a.8.8 0 0 0 0-1.6Z"
      />
    </svg>
  )
}
