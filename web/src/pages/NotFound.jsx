import { Link } from 'react-router-dom'
import { tr } from '../lib/i18n.js'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-serif text-2xl text-ink-violet">{tr('Halaman tidak ditemukan')}</h1>
      <p className="text-sm text-ink/70">{tr('Alamat yang kamu buka tidak tersedia.')}</p>
      <Link
        to="/"
        className="bg-pill inline-flex min-h-touch items-center rounded-full px-6 font-semibold text-white"
      >
        {tr('Kembali ke Beranda')}
      </Link>
    </main>
  )
}
