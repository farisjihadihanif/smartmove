import { useCallback, useEffect, useState } from 'react'
import {
  Banknote,
  Bike,
  CalendarDays,
  ChevronRight,
  Gift,
  Info,
  Map as MapIcon,
  Megaphone,
  Search,
  Signpost,
  TrafficCone,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/brand/logo.webp'
import { BottomNav } from '../components/AppNav.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import MenuTile from '../components/MenuTile.jsx'
import { NotificationButton } from '../components/NebulaHeader.jsx'
import SearchField from '../components/SearchField.jsx'
import SiteBar, { SignInButton } from '../components/SiteBar.jsx'
import NotificationSheet from '../components/home/NotificationSheet.jsx'
import { api, fileUrl } from '../lib/api.js'
import { useAuth } from '../lib/useAuth.js'
import { useNotifications } from '../lib/useNotifications.js'
import { jamAtauTanggal, jamWib, salamWib } from '../lib/wib.js'

// Beranda (mockup hal. 3): sapaan + jam Medan, lonceng, cari, 4 menu utama, Trip Planner,
// lalu ringkasan poin & event yang sedang berlangsung (data GET /home, API_SPECS §5).
// Terbuka untuk tamu (ARCHITECTURE §4): sapaan tanpa nama, tanpa lonceng & poin, ada tombol Masuk.

const MENU = [
  { to: '/navigasi', label: 'Smart Navigation', icon: MapIcon },
  { to: '/lalu-lintas', label: 'Live Traffic Information', icon: TrafficCone },
  { to: '/pembayaran', label: 'Digital Payment', icon: Banknote },
  { to: '/kampanye', label: 'Traffic Mitigation Campaign', icon: Megaphone },
]

const EVENT_ICON = { cfd: Bike, rekayasa_arus: Signpost, acara: CalendarDays, lainnya: Info }
const REFRESH_MS = 5 * 60 * 1000

/** Jam server berjalan: selisih jam server − jam perangkat dicatat saat data tiba. */
function useServerNow(offset) {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset)
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 15_000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [offset])
  return now
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  // Permintaan dibuat di sini; state diisi di callback (bukan langsung di dalam effect).
  const load = useCallback(
    (signal) =>
      api.get('/home', { signal }).then(
        (d) => {
          setData(d)
          setOffset(new Date(d.sapaan.waktuServer).getTime() - Date.now())
          setError(null)
        },
        (e) => {
          if (e.name !== 'AbortError') setError(e)
        },
      ),
    [],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    const refresh = () => load(ctrl.signal)
    const first = setTimeout(refresh, 0)
    const id = setInterval(refresh, REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      ctrl.abort()
      clearTimeout(first)
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const now = useServerNow(offset)
  const tamu = !user
  const nama = user?.namaLengkap || user?.username || ''
  const notif = useNotifications(user, data)
  const openNotifications = notif.open

  function search(q) {
    const s = q.trim()
    navigate(s ? `/navigasi?q=${encodeURIComponent(s)}` : '/navigasi')
  }

  return (
    <div className="min-h-dvh bg-surface pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-16">
      <header className="bg-lilac-wash rounded-b-[2rem] shadow-[0_10px_28px_-14px_rgb(65_57_111/0.6)] lg:rounded-b-[3rem]">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 lg:px-10 lg:pb-14 lg:pt-6">
          <SiteBar signedIn={!tamu} unread={notif.unread} onNotifications={openNotifications} />

          <div className="flex items-start gap-3 lg:mt-14 lg:items-end lg:gap-6">
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink-violet lg:text-base">
                Medan, <time dateTime={new Date(now).toISOString()}>{jamWib(now)}</time> WIB
              </p>
              <h1 className="font-serif text-[1.375rem] leading-[1.15] lg:text-[3.25rem] lg:leading-[1.05]">
                Hallo! {data?.sapaan.salam ?? salamWib(now)}
                {nama && (
                  <>
                    ,<br />
                    <span className="block truncate">{nama}</span>
                  </>
                )}
              </h1>
            </div>
            {tamu ? (
              <SignInButton className="lg:hidden" />
            ) : (
              <NotificationButton unread={notif.unread} onClick={openNotifications} className="lg:hidden" />
            )}
          </div>

          <SearchField
            value={query}
            onChange={setQuery}
            onSubmit={search}
            leading={<Search size={22} strokeWidth={2.25} aria-hidden="true" />}
            showSubmit={false}
            label="Cari tempat atau tujuan"
            className="mt-5 lg:mt-10 lg:max-w-2xl"
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 lg:px-10">
        {error && (
          <ErrorBanner error={error} onRetry={() => load()} className="mt-5" />
        )}

        <div className="mt-5 lg:mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
          <div>
            <nav
              aria-label="Menu utama"
              className="grid grid-cols-2 gap-x-1 gap-y-1 rounded-[1.75rem] bg-surface-menu px-1 py-3 ring-1 ring-ink-violet/[0.06] lg:grid-cols-4 lg:px-3 lg:py-6"
            >
              {MENU.map(({ to, label, icon: Icon }) => (
                <MenuTile key={to} to={to} label={label} icon={<Icon size={28} strokeWidth={1.9} />} />
              ))}
            </nav>

            <TripPlannerCard />
          </div>

          <aside className="mt-6 flex flex-col gap-6 lg:mt-0" aria-label="Ringkasan hari ini">
            {tamu ? <GuestCard /> : <PointsLink poin={data?.poin} loading={!data && !error} />}
            {data?.events?.length > 0 && <OngoingEvents events={data.events} now={now} />}
          </aside>
        </div>
      </main>

      <BottomNav className="lg:hidden" />

      <NotificationSheet
        open={notif.isOpen}
        onClose={notif.close}
        items={notif.items}
        lastSeen={notif.lastSeen}
        now={now}
      />
    </div>
  )
}

/** Pengganti ringkasan poin untuk tamu: ajakan masuk/daftar. */
function GuestCard() {
  return (
    <section className="rounded-[1.5rem] bg-white px-5 py-5 ring-1 ring-ink/[0.08] lg:px-6 lg:py-6">
      <h2 className="font-serif text-xl leading-snug">Simpan perjalanan & kumpulkan poin</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink/70">
        Masuk untuk memakai Trip Planner, Rewards, dan pembayaran tiket.
      </p>
      <div className="mt-4 flex gap-2">
        <Link
          to="/masuk"
          className="flex min-h-touch flex-1 items-center justify-center rounded-full bg-login-button px-5 text-[15px] font-semibold text-white transition hover:brightness-110"
        >
          Masuk
        </Link>
        <Link
          to="/daftar"
          className="flex min-h-touch flex-1 items-center justify-center rounded-full px-5 text-[15px] font-semibold text-login-button ring-2 ring-inset ring-login-button transition hover:bg-login-button/5"
        >
          Buat akun
        </Link>
      </div>
    </section>
  )
}

function Avatar({ user }) {
  if (!user) {
    return (
      <Link
        to="/masuk"
        aria-label="Masuk"
        className="grid size-14 shrink-0 place-items-center rounded-full bg-login-avatar text-white shadow-[0_4px_12px_rgb(65_57_111/0.3)] ring-[3px] ring-white lg:size-24"
      >
        <UserRound className="size-7 lg:size-11" aria-hidden="true" />
      </Link>
    )
  }
  const foto = fileUrl(user?.foto)
  const inisial = (user?.namaLengkap || user?.username || '?').trim().charAt(0).toUpperCase()
  return (
    <Link
      to="/akun"
      aria-label="Akun"
      className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-login-avatar font-serif text-2xl text-white shadow-[0_4px_12px_rgb(65_57_111/0.3)] ring-[3px] ring-white lg:size-24 lg:text-4xl"
    >
      {foto ? <img src={foto} alt="" className="size-full object-cover" /> : <span aria-hidden="true">{inisial}</span>}
    </Link>
  )
}

function TripPlannerCard() {
  return (
    <Link
      to="/trip-planner"
      className="bg-trip-card grain group relative mt-6 flex min-h-[7.5rem] items-center gap-4 overflow-hidden rounded-[1.75rem] py-4 pl-4 pr-3 text-white shadow-[0_14px_30px_-16px_rgb(95_63_115/0.9)] lg:mt-8 lg:min-h-[10rem] lg:gap-6 lg:px-8"
    >
      <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/90 shadow-[0_4px_14px_rgb(95_63_115/0.35)] lg:size-24 lg:rounded-3xl">
        <img src={logo} alt="" width="52" height="40" className="w-[46px] lg:w-[68px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-2xl leading-tight drop-shadow-[0_1px_2px_rgb(65_57_111/0.35)] lg:text-4xl">
          Trip Planner
        </span>
        <span className="mt-1 block font-serif text-[15px] leading-snug text-white/95 lg:mt-2 lg:text-lg">
          Buat perencanaan terbaik untuk setiap perjalananmu
        </span>
      </span>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20 transition group-hover:bg-white/30 lg:size-12">
        <ChevronRight size={22} aria-hidden="true" />
      </span>
    </Link>
  )
}

function PointsLink({ poin, loading }) {
  return (
    <Link
      to="/rewards"
      className="flex items-center gap-4 rounded-[1.5rem] bg-white px-4 py-4 ring-1 ring-ink/[0.08] transition hover:ring-ink-violet/30 lg:flex-col lg:items-start lg:gap-3 lg:px-6 lg:py-6"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-traffic-padat/15 text-[#9A5B00]">
        <Gift size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1" aria-busy={loading || undefined}>
        {loading ? (
          <span className="block h-7 w-28 animate-pulse rounded-lg bg-ink/10" />
        ) : (
          <>
            <span className="block font-serif text-2xl leading-tight lg:text-4xl">
              {(poin?.saldo ?? 0).toLocaleString('id-ID')} poin
            </span>
            <span className="block text-sm text-ink/65">
              {poin?.bulanIni ? `+${poin.bulanIni.toLocaleString('id-ID')} bulan ini` : 'Kumpulkan dari perjalanan & pembayaran'}
            </span>
          </>
        )}
      </span>
      <ChevronRight size={20} className="shrink-0 text-ink/40 lg:hidden" aria-hidden="true" />
    </Link>
  )
}

function OngoingEvents({ events, now }) {
  return (
    <section aria-labelledby="event-title">
      <h2 id="event-title" className="px-1 text-base font-bold">
        Sedang berlangsung
      </h2>
      <ul className="mt-2 divide-y divide-ink/[0.07] rounded-[1.5rem] bg-white px-4 ring-1 ring-ink/[0.08]">
        {events.map((e) => {
          const Icon = EVENT_ICON[e.jenis] ?? Info
          return (
            <li key={e.id} className="flex items-start gap-3 py-3.5">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-traffic-padat/15 text-[#9A5B00]">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug">{e.judul}</span>
                <span className="block text-sm text-ink/65">Sampai {jamAtauTanggal(e.selesai, now)} WIB</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
