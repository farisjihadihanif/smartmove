import AppLayout from '../components/AppLayout.jsx'
import { useAuth } from '../lib/useAuth.js'
import Home from './Home.jsx'
import Splash from './Splash.jsx'

// "/" untuk tamu = Splash (sambutan), untuk pengguna masuk = Beranda.
export default function Index() {
  const { status } = useAuth()
  if (status === 'memuat') return <div className="min-h-dvh bg-splash-bg" aria-busy="true" />
  if (status === 'tamu') return <Splash />
  return (
    <AppLayout>
      <Home />
    </AppLayout>
  )
}
