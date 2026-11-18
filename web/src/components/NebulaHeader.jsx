import { Mail } from 'lucide-react'

/**
 * Header bertekstur cat air lilac (mockup hal. 3–7).
 * - `leading`: ikon fitur / avatar di lingkaran kiri.
 * - `title`: judul layar (Open Sans tebal) atau sapaan (`serif`, Bree Serif – Beranda).
 * - `unread` + `onNotifications`: tombol amplop kanan dengan lencana jumlah.
 * - `children`: isi di bawah judul (SearchField, PillToggle, …).
 */
export default function NebulaHeader({
  leading,
  title,
  serif = false,
  unread = 0,
  onNotifications,
  children,
  className = '',
}) {
  return (
    <header className={`bg-lilac-wash px-4 pb-5 pt-4 text-ink ${className}`}>
      <div className="flex min-h-touch items-center gap-3">
        {leading && (
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-2 ring-ink-violet/80">
            {leading}
          </div>
        )}
        <h1
          className={
            serif
              ? 'flex-1 text-center font-serif text-xl leading-snug'
              : 'flex-1 text-xl font-semibold leading-tight tracking-[0.01em]'
          }
        >
          {title}
        </h1>
        {onNotifications && <NotificationButton unread={unread} onClick={onNotifications} />}
      </div>
      {children && <div className="mt-4 flex flex-col gap-4">{children}</div>}
    </header>
  )
}

function NotificationButton({ unread, onClick }) {
  const label = unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative grid size-touch shrink-0 place-items-center rounded-full"
    >
      <span className="grid size-9 place-items-center rounded-full border-[1.5px] border-ink bg-white/30">
        <Mail size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border border-white bg-ink px-1 text-[11px] font-semibold leading-none text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
