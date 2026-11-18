import { ArrowLeft, Hammer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BottomNav } from '../components/AppNav.jsx'
import EmptyState from '../components/EmptyState.jsx'
import NebulaHeader from '../components/NebulaHeader.jsx'
import { useAuth } from '../lib/useAuth.js'

// Tujuan menu Beranda yang layarnya dibuat di tugas berikutnya (TASK.md).
// Akun sementara di sini juga, agar tombol Keluar tetap ada.
export default function Segera({ title, account = false }) {
  const { user, signOut } = useAuth()
  return (
    <div className="mx-auto flex min-h-dvh max-w-screen-sm flex-col bg-surface pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <NebulaHeader
        title={title}
        leading={
          <Link to="/" aria-label="Kembali ke Beranda" className="grid size-full place-items-center">
            <ArrowLeft size={22} aria-hidden="true" />
          </Link>
        }
      />
      <main className="flex flex-1 flex-col items-center justify-center">
        {account && user && (
          <p className="px-6 text-center text-[15px] text-ink/70">
            Masuk sebagai <strong className="text-ink">{user.namaLengkap || user.username}</strong>
            <br />
            {user.email}
          </p>
        )}
        <EmptyState
          icon={Hammer}
          title="Segera hadir"
          message={account ? 'Ubah profil, foto, dan password akan ada di sini.' : 'Layar ini sedang disiapkan. Sementara, kembali ke Beranda.'}
          action={account ? { label: 'Keluar', onClick: signOut } : undefined}
        />
      </main>
      <BottomNav />
    </div>
  )
}
