import { Hammer } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import PageShell from '../components/PageShell.jsx'
import { useAuth } from '../lib/useAuth.js'

// Tujuan menu Beranda yang layarnya dibuat di tugas berikutnya (TASK.md).
// Akun sementara di sini juga, agar tombol Keluar tetap ada.
export default function Segera({ title, account = false }) {
  const { user, signOut } = useAuth()
  return (
    <PageShell title={title}>
      <div className="flex flex-1 flex-col items-center justify-center lg:py-16">
        {account && user && (
          <p className="px-6 text-center text-[15px] text-ink/70">
            Masuk sebagai <strong className="text-ink">{user.namaLengkap || user.username}</strong>
            <br />
            {user.email}
          </p>
        )}
        {account && user?.role === 'admin' && (
          <Link to="/admin" className="mt-6 inline-flex min-h-touch items-center rounded-full bg-pill px-6 font-semibold text-white">
            Buka dasbor admin
          </Link>
        )}
        <EmptyState
          icon={Hammer}
          title="Segera hadir"
          message={account ? 'Ubah profil, foto, dan password akan ada di sini.' : 'Layar ini sedang disiapkan. Sementara, kembali ke Beranda.'}
          action={account ? { label: 'Keluar', onClick: signOut } : undefined}
        />
      </div>
    </PageShell>
  )
}
