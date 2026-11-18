import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-serif text-2xl text-primary">Halaman tidak ditemukan</h1>
      <p className="text-sm text-primary-deep/80">Alamat yang kamu buka tidak tersedia.</p>
      <Link
        to="/"
        className="bg-nebula inline-flex min-h-touch items-center rounded-full px-6 font-semibold text-white"
      >
        Kembali ke Beranda
      </Link>
    </main>
  )
}
