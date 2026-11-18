import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.js'
import { welcomeSeen } from '../lib/welcome.js'
import Home from './Home.jsx'

// "/" = Beranda untuk semua orang; tamu (ARCHITECTURE §4) melihat versi tanpa nama/poin.
// Tamu yang baru pertama kali datang diarahkan sekali ke Splash sambutan.
export default function Index() {
  const { status, user } = useAuth()
  if (status === 'memuat') return <div className="min-h-dvh bg-surface" aria-busy="true" />
  if (status === 'tamu' && !welcomeSeen()) return <Navigate to="/selamat-datang" replace />
  // key: muat ulang data & status lonceng saat pengguna berganti.
  return <Home key={user?.id ?? 'tamu'} />
}
