import { Gift, House, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'

// Navigasi utama (mockup hal. 3: Home · Rewards · Account).
// Ponsel: bar bawah gaya Material 3; desktop: tautan di header.
const NAV_ITEMS = [
  { to: '/', label: 'Beranda', icon: House, end: true },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/akun', label: 'Akun', icon: UserRound },
]

export function BottomNav({ className = '' }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-ink/5 bg-surface-nav/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md ${className}`}
    >
      <ul className="mx-auto grid max-w-screen-sm grid-cols-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className="group flex min-h-[4.5rem] flex-col items-center justify-center gap-1">
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-8 w-16 place-items-center rounded-full transition-colors ${
                      isActive ? 'bg-[color:var(--color-lilac-wash)] text-icon-blue-deep' : 'text-ink/55 group-hover:bg-ink/5'
                    }`}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                  </span>
                  <span className={`text-xs ${isActive ? 'font-bold text-ink' : 'font-medium text-ink/65'}`}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function TopNav({ className = '' }) {
  return (
    <nav aria-label="Navigasi utama" className={className}>
      <ul className="flex items-center gap-1 rounded-full bg-white/45 p-1 backdrop-blur-sm">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-2 rounded-full px-4 text-sm transition-colors ${
                  isActive ? 'bg-white font-bold text-ink shadow-[0_2px_8px_rgb(65_57_111/0.18)]' : 'font-medium text-ink/75 hover:bg-white/60'
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
  )
}
