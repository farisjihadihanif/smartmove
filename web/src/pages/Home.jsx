import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { api } from '../lib/api.js'

const STATUS_CLASS = {
  memeriksa: 'text-ink-violet',
  tersambung: 'font-semibold text-traffic-lancar',
  gagal: 'font-semibold text-traffic-macet',
}

// Halaman sementara untuk memastikan token warna, font, router, dan klien API bekerja.
// Diganti Beranda sesungguhnya di T-104.
export default function Home() {
  const [status, setStatus] = useState('memeriksa')

  useEffect(() => {
    const ctrl = new AbortController()
    api
      .get('/health', { signal: ctrl.signal })
      .then((d) => setStatus(d?.ok ? 'tersambung' : 'gagal'))
      .catch((e) => {
        if (e.name !== 'AbortError') setStatus('gagal')
      })
    return () => ctrl.abort()
  }, [])

  return (
    <>
      <header className="bg-lilac-wash px-4 pb-8 pt-10 text-ink">
        <div className="flex items-center gap-2 text-sm opacity-90">
          <MapPin size={18} aria-hidden="true" />
          <span>Medan</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl">SmartMove Medan</h1>
        <p className="mt-1 text-sm opacity-90">Bergerak lebih cerdas di kota Medan.</p>
      </header>
      <main className="flex-1 px-4 py-6">
        <p className="text-sm">
          Status API: <span className={STATUS_CLASS[status]}>{status}</span>
        </p>
      </main>
    </>
  )
}
