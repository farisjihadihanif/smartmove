import { useState } from 'react'
import { Search } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import SearchField from '../../components/SearchField.jsx'
import { Chip, Halaman, Judul, Tabel, kelasInput } from '../../components/admin/ui.jsx'
import { STATUS, namaMetode, rupiah } from '../../lib/pembayaran.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { jamAtauTanggal } from '../../lib/wib.js'

const NADA = { lancar: 'hijau', padat: 'kuning', macet: 'merah', abu: 'netral' }

// Transaksi pembayaran simulasi (T-304). Pemilik akun yang dihapus tampil "Pengguna dihapus"
// (TASK Keputusan #15); transaksinya tetap utuh.
export default function Transaksi() {
  const [status, setStatus] = useState('')
  const [cari, setCari] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, error, muatUlang } = useApiGet('/admin/payments', { status, q, page })
  const [now] = useState(() => Date.now())
  const lunas = data?.ringkasan?.lunas

  return (
    <>
      <Judul
        aksi={
          <label className="flex items-center gap-2 text-sm font-semibold">
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className={`${kelasInput} w-auto`}
            >
              <option value="">Semua</option>
              {Object.entries(STATUS).map(([v, s]) => (
                <option key={v} value={v}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        }
      >
        Transaksi
      </Judul>
      <p className="mb-4 text-sm text-ink/65">
        Semua transaksi adalah simulasi (Midtrans sandbox).
        {lunas ? ` ${lunas.jumlah} lunas, total ${rupiah(lunas.nilai)}.` : ''}
      </p>
      <SearchField
        value={cari}
        onChange={setCari}
        onSubmit={(v) => {
          setQ(v.trim())
          setPage(1)
        }}
        placeholder="Cari no. pesanan, layanan, atau username"
        label="Cari transaksi"
        leading={<Search size={20} className="text-ink-violet" aria-hidden="true" />}
        className="mb-4 max-w-lg"
      />
      {error && <ErrorBanner error={error} onRetry={muatUlang} className="mb-4" />}
      <Tabel label="Daftar transaksi" kolom={['Waktu', 'No. pesanan', 'Pengguna', 'Layanan', 'Jumlah', 'Status']}>
        {data?.items.map((p) => (
          <tr key={p.orderId}>
            <td className="whitespace-nowrap px-3 py-3 text-ink/70">{jamAtauTanggal(p.createdAt, now)}</td>
            <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums">{p.orderId}</td>
            <td className="px-3 py-3">{p.pengguna.id ? p.pengguna.username : <span className="italic text-ink/55">{p.pengguna.label}</span>}</td>
            <td className="px-3 py-3">
              {p.layanan.nama}
              <span className="block text-xs text-ink/55">
                {p.penumpang} {p.layanan.jenis === 'parkir' ? 'jam' : 'orang'}
                {p.metode ? `, ${namaMetode(p.metode)}` : ''}
              </span>
            </td>
            <td className="whitespace-nowrap px-3 py-3 tabular-nums">{rupiah(p.jumlah)}</td>
            <td className="px-3 py-3">
              <Chip nada={NADA[STATUS[p.status]?.nada] ?? 'netral'}>{STATUS[p.status]?.label ?? p.status}</Chip>
            </td>
          </tr>
        ))}
      </Tabel>
      {data && data.items.length === 0 && <p className="mt-4 text-sm text-ink/60">Tidak ada transaksi yang cocok.</p>}
      {data && <Halaman page={data.page} total={data.total} limit={30} onPage={setPage} />}
    </>
  )
}
