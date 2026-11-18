import { Mail } from 'lucide-react'

/**
 * Header bertekstur cat air lilac (mockup hal. 3–7), sudut bawah membulat agar isi di bawahnya terasa naik.
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
    <header
      className={`bg-lilac-wash relative z-10 rounded-b-[1.75rem] px-4 pb-5 pt-4 text-ink shadow-[0_8px_20px_-8px_rgb(65_57_111/0.5)] ${className}`}
    >
      <div className="flex min-h-touch items-center gap-3">
        {leading && (
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-ink-violet shadow-[0_2px_8px_rgb(65_57_111/0.25)] ring-2 ring-white">
            {leading}
          </div>
        )}
        <h1
          className={
            serif
              ? 'flex-1 font-serif text-[1.375rem] leading-snug'
              : 'flex-1 text-xl font-bold leading-tight'
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
      <span className="grid size-10 place-items-center rounded-full bg-white/75 shadow-[0_2px_8px_rgb(65_57_111/0.18)] backdrop-blur-sm">
        <Mail size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-traffic-macet px-1 text-[10px] font-bold leading-none text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
