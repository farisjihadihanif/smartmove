import { LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/brand/logo.webp'
import { TopNav } from './AppNav.jsx'
import { NotificationButton } from './NebulaHeader.jsx'

/**
 * Bar atas web desktop (≥ lg), sama di semua layar: logo, menu Beranda/Rewards/Akun, lonceng.
 * Tamu melihat tombol Masuk di tempat lonceng. Di ponsel tidak tampil (navigasi di bar bawah).
 */
export default function SiteBar({ signedIn, unread = 0, onNotifications, className = '' }) {
  return (
    <div className={`hidden min-h-touch items-center justify-between gap-6 lg:flex ${className}`}>
      <Link to="/" className="flex items-center gap-3 rounded-full pr-2">
        <span className="grid size-11 place-items-center rounded-full bg-white/85">
          <img src={logo} alt="" width="34" height="26" className="w-[34px]" />
        </span>
        <span className="font-serif text-lg leading-none">SmartMove Medan</span>
      </Link>
      <div className="flex items-center gap-3">
        <TopNav />
        {signedIn ? <NotificationButton unread={unread} onClick={onNotifications} /> : <SignInButton />}
      </div>
    </div>
  )
}

export function SignInButton({ className = '' }) {
  return (
    <Link
      to="/masuk"
      className={`flex min-h-touch shrink-0 items-center gap-2 rounded-full bg-login-button px-5 text-[15px] font-semibold text-white shadow-[0_6px_16px_-6px_rgb(115_36_169/0.8)] transition hover:brightness-110 ${className}`}
    >
      <LogIn size={18} aria-hidden="true" />
      Masuk
    </Link>
  )
}
