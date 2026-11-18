import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Kerangka layar akun (mockup hal. 2): gradasi indigo → magenta, avatar bulat, judul kapital.
 * Di layar lebar kolomnya tetap sempit seperti layar ponsel.
 */
export function AuthShell({ title, children, avatar = true }) {
  return (
    <div className="min-h-dvh bg-login text-white">
      <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-6 pb-10 pt-[max(3rem,8vh)]">
        {avatar && (
          <div
            aria-hidden="true"
            className="mx-auto grid size-32 place-items-center rounded-full bg-login-avatar/90 sm:size-36"
          >
            <PersonSolid size={72} className="text-indigo" />
          </div>
        )}
        <h1 className="mt-7 text-center text-[1.625rem] font-bold leading-tight tracking-[0.01em]">{title}</h1>
        {children}
      </main>
    </div>
  )
}

/**
 * Kolom berikon (mockup hal. 2): sel ikon + celah tipis + sel isian, latar `login-field`,
 * teks indigo rata tengah. Label tetap ada untuk pembaca layar.
 */
export function AuthField({ icon: Icon, label, type = 'text', reveal = false, ...props }) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const inputType = reveal ? (shown ? 'text' : 'password') : type

  return (
    <div className="group flex h-14 rounded-2xl outline-offset-2 outline-white focus-within:outline-2">
      <label
        htmlFor={id}
        className="grid w-14 shrink-0 place-items-center rounded-l-2xl bg-login-field text-indigo"
      >
        <Icon size={26} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </label>
      <div className="ml-1.5 flex min-w-0 flex-1 items-center rounded-r-2xl bg-login-field">
        <input
          id={id}
          type={inputType}
          placeholder={label}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-center text-lg font-semibold text-indigo outline-none placeholder:font-semibold placeholder:text-indigo/60"
          {...props}
        />
        {reveal && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'Sembunyikan password' : 'Tampilkan password'}
            aria-pressed={shown}
            className="grid size-touch shrink-0 place-items-center rounded-full text-indigo/70 hover:text-indigo"
          >
            {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  )
}

/** Tombol utama ungu (mockup: "Login"). */
export function AuthButton({ busy, children, className = '', ...props }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy || undefined}
      className={`mx-auto flex min-h-touch min-w-44 items-center justify-center rounded-full bg-login-button px-8 text-lg font-semibold text-white shadow-[0_2px_8px_rgb(51_51_153/0.35)] transition hover:brightness-110 disabled:opacity-70 ${className}`}
      {...props}
    >
      {busy ? 'Tunggu sebentar…' : children}
    </button>
  )
}

/** Pesan sukses di atas gradasi (mis. email reset terkirim). */
export function AuthNotice({ children }) {
  return (
    <p role="status" className="rounded-2xl bg-login-field px-4 py-3 text-sm leading-relaxed text-indigo">
      {children}
    </p>
  )
}

export const linkClass = 'font-semibold text-white underline underline-offset-2 hover:decoration-2'

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
