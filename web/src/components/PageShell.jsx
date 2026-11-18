import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BottomNav } from './AppNav.jsx'
import SiteBar from './SiteBar.jsx'
import NotificationSheet from './home/NotificationSheet.jsx'
import { useAuth } from '../lib/useAuth.js'
import { useMediaQuery, useNotifications } from '../lib/useNotifications.js'

const DESKTOP = '(min-width: 64rem)'

/**
 * Kerangka layar dalam web (semua layar selain Beranda).
 * - Ponsel (< lg): header lilac bertekstur (tombol kembali di lingkaran + judul), isi, navigasi bawah.
 * - Desktop (≥ lg): bar atas yang sama dengan Beranda (SiteBar), lalu tombol kembali + judul
 *   Bree Serif di bawahnya; tanpa navigasi bawah. Lebar isi = Beranda (max-w-6xl).
 * `toolbar`: isi tambahan di header (kolom cari, PillToggle); di bawah judul, sebaris dengan judul mulai xl.
 * `map`: layar peta — tinggi tepat satu layar, `children` mengisi sisa tinggi selebar layar,
 *   tanpa navigasi bawah (layar peta punya bar aksi sendiri).
 */
export default function PageShell({ title, backTo = '/', backLabel = 'Kembali ke Beranda', toolbar, map = false, children }) {
  const { user } = useAuth()
  const desktop = useMediaQuery(DESKTOP)
  const notif = useNotifications(user, null, { fetchOwn: desktop })

  return (
    <div
      className={
        map
          ? 'flex h-dvh flex-col overflow-hidden bg-surface'
          : 'flex min-h-dvh flex-col bg-surface pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-16'
      }
    >
      <header className="bg-lilac-wash relative z-10 rounded-b-[1.75rem] px-4 pb-5 pt-4 text-ink shadow-[0_8px_20px_-8px_rgb(65_57_111/0.5)] lg:rounded-b-[2.5rem] lg:px-0 lg:pb-7 lg:pt-6">
        <div className="lg:mx-auto lg:max-w-6xl lg:px-10">
          <SiteBar signedIn={!!user} unread={notif.unread} onNotifications={notif.open} />
          <div className={`lg:mt-7 ${toolbar ? 'xl:flex xl:items-center xl:gap-8' : ''}`}>
            <div className="flex min-h-touch items-center gap-3 lg:shrink-0 lg:gap-4">
              <Link
                to={backTo}
                aria-label={backLabel}
                className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-ink-violet shadow-[0_2px_8px_rgb(65_57_111/0.25)] ring-2 ring-white transition hover:bg-[color:var(--color-lilac-wash)]"
              >
                <ArrowLeft size={22} aria-hidden="true" />
              </Link>
              <h1 className="flex-1 text-xl font-bold leading-tight lg:font-serif lg:text-[2.25rem] lg:font-normal lg:leading-none">
                {title}
              </h1>
            </div>
            {toolbar && (
              <div className="mt-4 flex flex-col gap-4 lg:mt-5 lg:flex-row lg:items-center lg:gap-4 xl:mt-0 xl:flex-1 xl:justify-end">
                {toolbar}
              </div>
            )}
          </div>
        </div>
      </header>

      {map ? (
        children
      ) : (
        <>
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 lg:px-10">{children}</main>
          <BottomNav className="lg:hidden" />
        </>
      )}

      <NotificationSheet open={notif.isOpen} onClose={notif.close} items={notif.items} lastSeen={notif.lastSeen} now={notif.openedAt} />
    </div>
  )
}
