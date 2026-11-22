import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import SearchField from '../../components/SearchField.jsx'
import { Chip, Halaman, Judul, Tabel, Tombol, TombolHapus } from '../../components/admin/ui.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { hariWib } from '../../lib/wib.js'
import { tr } from '../../lib/i18n.js'

// Pengguna: cari, ubah peran, hapus akun beserta data pribadinya.
export default function Pengguna() {
  const { user: saya } = useAuth()
  const [q, setQ] = useState('')
  const [cari, setCari] = useState('')
  const [page, setPage] = useState(1)
  const [galat, setGalat] = useState(null)
  const { data, error, muatUlang } = useApiGet('/admin/users', { q: cari, page })
  const [now] = useState(() => Date.now())

  async function aksi(fn) {
    setGalat(null)
    try {
      await fn()
      muatUlang()
    } catch (e) {
      setGalat(e)
    }
  }

  return (
    <>
      <Judul>{tr('Pengguna')}</Judul>
      <div className="mb-4 max-w-md">
        <SearchField
          value={q}
          onChange={(v) => {
            setQ(v)
            if (!v) setCari('')
          }}
          onSubmit={(v) => {
            setCari(v.trim())
            setPage(1)
          }}
          placeholder={tr('Username, email, atau nama')}
          label={tr('Cari pengguna')}
        />
      </div>
      {(error || galat) && <ErrorBanner error={error || galat} onRetry={error ? muatUlang : undefined} className="mb-4" />}
      <Tabel label={tr('Daftar pengguna')} kolom={[tr('Pengguna'), tr('Email'), tr('Peran'), tr('Bergabung'), '']}>
        {data?.items.map((u) => {
          const diriSendiri = u.id === saya?.id
          return (
            <tr key={u.id}>
              <td className="px-3 py-3">
                <span className="font-semibold">{u.username}</span>
                {u.namaLengkap && <span className="block text-xs text-ink/60">{u.namaLengkap}</span>}
              </td>
              <td className="px-3 py-3 text-ink/75">{u.email}</td>
              <td className="px-3 py-3">
                <Chip nada={u.role === 'admin' ? 'ungu' : 'netral'}>{u.role === 'admin' ? tr('Admin') : tr('Pengguna')}</Chip>
              </td>
              <td className="px-3 py-3 text-ink/65">{hariWib(u.createdAt, now)}</td>
              <td className="px-3 py-2 text-right">
                {diriSendiri ? (
                  <span className="text-xs text-ink/50">{tr('Akunmu')}</span>
                ) : (
                  <span className="inline-flex flex-wrap justify-end gap-2">
                    <Tombol
                      jenis="biasa"
                      onClick={() => aksi(() => api.patch(`/admin/users/${u.id}`, { role: u.role === 'admin' ? 'user' : 'admin' }))}
                    >
                      {u.role === 'admin' ? tr('Jadikan pengguna') : tr('Jadikan admin')}
                    </Tombol>
                    <TombolHapus onHapus={() => aksi(() => api.del(`/admin/users/${u.id}`))} />
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </Tabel>
      {data && data.items.length === 0 && <p className="mt-4 text-sm text-ink/60">{tr('Tidak ada pengguna yang cocok.')}</p>}
      {data && <Halaman page={data.page} total={data.total} onPage={setPage} />}
      <p className="mt-6 max-w-[60ch] text-xs leading-relaxed text-ink/55">
        {tr('Menghapus akun juga menghapus rencana perjalanan, laporan, umpan balik, poin, dan vouchernya. Riwayat pembayaran simulasi tetap disimpan atas nama “Pengguna dihapus”.')}
      </p>
    </>
  )
}
