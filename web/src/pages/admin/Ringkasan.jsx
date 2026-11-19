import { Link } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import { Judul } from '../../components/admin/ui.jsx'
import { useApiGet } from '../../lib/useApiGet.js'

// Ringkasan dasbor admin: angka utama + daftar yang perlu dicek.
export default function Ringkasan() {
  const { status, data: s, error, muatUlang } = useApiGet('/admin/stats')
  if (status === 'galat') return <ErrorBanner error={error} onRetry={muatUlang} />
  if (!s) return <p className="text-sm text-ink/60">Memuat ringkasan…</p>

  const angka = [
    { label: 'Pengguna', nilai: s.pengguna.total, ket: `${s.pengguna.baru7Hari} baru minggu ini`, to: '/admin/pengguna' },
    { label: 'Laporan lalu lintas aktif', nilai: s.laporanAktif, ket: 'hilang otomatis setelah 2 jam', to: '/admin/laporan' },
    { label: 'Event berlangsung & mendatang', nilai: s.eventAktif, to: '/admin/event' },
    {
      label: 'Umpan balik',
      nilai: s.umpanBalik.total,
      ket: s.umpanBalik.rataRating ? `rata-rata ${s.umpanBalik.rataRating.toLocaleString('id-ID')} dari 5` : 'belum ada',
      to: '/admin/umpan-balik',
    },
    { label: 'Rencana perjalanan tersimpan', nilai: s.trip },
    { label: 'Konten kampanye aktif', nilai: s.konten, to: '/admin/konten' },
  ]
  const cek = [
    s.koridorTransit.periksaJenis > 0 && {
      teks: `${s.koridorTransit.periksaJenis} koridor Trans Metro Deli tercatat “angkot” di OSM. Periksa jenisnya.`,
      to: '/admin/transit?periksa=jenis',
    },
    s.koridorTransit.tarifBelumAdmin > 0 && {
      teks: `${s.koridorTransit.tarifBelumAdmin} dari ${s.koridorTransit.aktif} koridor aktif masih memakai tarif perkiraan.`,
      to: '/admin/transit?periksa=tarif',
    },
    {
      teks: `Jalan utama: ${s.jalanUtama.dikoreksi} dari ${s.jalanUtama.total} garis sudah dikoreksi admin${
        s.jalanUtama.disembunyikan ? `, ${s.jalanUtama.disembunyikan} disembunyikan` : ''
      }.`,
      to: '/admin/jalan',
    },
  ].filter(Boolean)

  return (
    <>
      <Judul>Ringkasan</Judul>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-b border-ink/10 pb-8 md:grid-cols-3">
        {angka.map((a) => (
          <div key={a.label}>
            <dt className="text-sm text-ink/65">{a.label}</dt>
            <dd className="mt-1 font-serif text-[2.25rem] leading-none tabular-nums">
              {a.to ? (
                <Link to={a.to} className="hover:text-ink-violet">
                  {a.nilai.toLocaleString('id-ID')}
                </Link>
              ) : (
                a.nilai.toLocaleString('id-ID')
              )}
            </dd>
            {a.ket && <dd className="mt-1 text-xs text-ink/55">{a.ket}</dd>}
          </div>
        ))}
      </dl>
      <h2 className="mt-8 font-serif text-xl">Perlu dicek</h2>
      <ul className="mt-2 divide-y divide-ink/[0.06]">
        {cek.map((c) => (
          <li key={c.to}>
            <Link to={c.to} className="flex min-h-touch items-center justify-between gap-4 py-3 text-[15px] hover:text-ink-violet">
              <span>{c.teks}</span>
              <span className="shrink-0 text-sm font-semibold text-ink-violet">Buka</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
