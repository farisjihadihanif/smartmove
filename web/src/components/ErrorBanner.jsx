import { CircleAlert, WifiOff, X } from 'lucide-react'
import { errorMessage, isOffline } from '../lib/errors.js'

/**
 * Banner galat (DESIGN §5). Isi `error` (ApiError) atau `message`.
 * Galat jaringan otomatis memakai ikon offline. `onRetry` menampilkan tombol "Coba lagi".
 */
export default function ErrorBanner({ error, message, onRetry, retryLabel = 'Coba lagi', onDismiss, className = '' }) {
  const text = message || errorMessage(error)
  if (!text) return null
  const Icon = isOffline(error) ? WifiOff : CircleAlert

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 rounded-2xl border-l-4 border-traffic-macet bg-login-field py-1 pl-3 pr-1 text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)] ${className}`}
    >
      <Icon size={22} strokeWidth={2.25} className="shrink-0 text-traffic-macet" aria-hidden="true" />
      <p className="flex-1 py-2 text-sm leading-snug">{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-touch shrink-0 rounded-full px-3 text-sm font-semibold text-ink-violet hover:bg-ink-violet/10"
        >
          {retryLabel}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup"
          className="grid size-touch shrink-0 place-items-center rounded-full text-ink/60 hover:bg-black/5"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
