import { BarChart3, Bus, CalendarClock, FileText, Gift, Home, MessageSquare, Receipt, Route, Ticket, TriangleAlert, Users } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/useAuth.js'

// Kerangka dasbor admin (DESIGN §7, T-208): pita lilac tipis + navigasi
// (sidebar ungu tua di desktop, tab geser di ponsel) + isi.

const MENU = [
  { to: '/admin', end: true, label: 'Ringkasan', icon: BarChart3 },
  { to: '/admin/transit', label: 'Koridor & halte', icon: Bus },
  { to: '/admin/jalan', label: 'Jalan utama', icon: Route },
  { to: '/admin/event', label: 'EventAlert', icon: CalendarClock },
  { to: '/admin/konten', label: 'Tips & poster', icon: FileText },
  { to: '/admin/laporan', label: 'Laporan lalu lintas', icon: TriangleAlert },
  { to: '/admin/umpan-balik', label: 'Umpan balik', icon: MessageSquare },
  { to: '/admin/layanan', label: 'Katalog pemesanan', icon: Ticket },
  { to: '/admin/voucher', label: 'Voucher', icon: Gift },
  { to: '/admin/transaksi', label: 'Transaksi', icon: Receipt },
  { to: '/admin/pengguna', label: 'Pengguna', icon: Users },
]

export default function AdminShell() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const nav = useRef(null)
  // Ponsel: tab aktif digeser ke tampilan.
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])
  return (
    <div className="min-h-dvh bg-surface lg:flex">
      <aside className="bg-ink-violet text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="bg-lilac-wash flex items-center gap-3 px-4 py-3 text-ink lg:px-5 lg:py-5">
          <Link
            to="/"
            aria-label="Ke Beranda SmartMove"
            className="grid size-touch shrink-0 place-items-center rounded-full bg-card text-ink-violet shadow-[0_2px_8px_rgb(65_57_111/0.25)]"
          >
            <Home size={20} aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <p className="font-serif text-xl leading-tight">Dasbor Admin</p>
            <p className="truncate text-xs text-ink/65">{user?.namaLengkap || user?.username}</p>
          </div>
        </div>
        <nav ref={nav} aria-label="Menu admin" className="overflow-x-auto [scrollbar-width:none] lg:flex-1 lg:overflow-y-auto lg:py-3">
          <ul className="flex gap-1 px-2 py-2 lg:flex-col lg:px-3 lg:py-0">
            {MENU.map(({ to, end, label, icon: Icon }) => (
              <li key={to} className="shrink-0">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex min-h-touch items-center gap-3 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition lg:rounded-2xl ${
                      isActive ? 'bg-card text-ink-violet' : 'text-white/80 hover:bg-card/10 hover:text-white'
                    }`
                  }
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
