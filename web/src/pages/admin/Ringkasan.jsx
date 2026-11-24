import { Link } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import { Judul } from '../../components/admin/ui.jsx'
import { useApiGet } from '../../lib/useApiGet.js'
import { tr, locale } from '../../lib/i18n.js'
import CountUp from '../../components/CountUp.jsx'
import { revealList, revealUp } from '../../lib/reveal.js'

// Ringkasan dasbor admin: angka utama + daftar yang perlu dicek.
export default function Ringkasan() {
  const { status, data: s, error, muatUlang } = useApiGet('/admin/stats')
  if (status === 'galat') return <ErrorBanner error={error} onRetry={muatUlang} />
  if (!s) return <p className="text-sm text-ink/60">{tr('Memuat ringkasan…')}</p>

  const angka = [
    { label: tr('Pengguna'), nilai: s.pengguna.total, ket: tr("{0} baru minggu ini", { 0: s.pengguna.baru7Hari }), to: '/admin/pengguna' },
    { label: tr('Laporan lalu lintas aktif'), nilai: s.laporanAktif, ket: tr('hilang otomatis setelah 2 jam'), to: '/admin/laporan' },
    { label: tr('Event berlangsung & mendatang'), nilai: s.eventAktif, to: '/admin/event' },
    {
      label: tr('Umpan balik'),
      nilai: s.umpanBalik.total,
      ket: s.umpanBalik.rataRating ? tr("rata-rata {0} dari 5", { 0: s.umpanBalik.rataRating.toLocaleString(locale) }) : tr('belum ada'),
      to: '/admin/umpan-balik',
    },
    { label: tr('Rencana perjalanan tersimpan'), nilai: s.trip },
    { label: tr('Konten kampanye aktif'), nilai: s.konten, to: '/admin/konten' },
  ]
  const cek = [
    s.koridorTransit.periksaJenis > 0 && {
      teks: tr("{0} koridor Trans Metro Deli tercatat “angkot” di OSM. Periksa jenisnya.", { 0: s.koridorTransit.periksaJenis }),
      to: '/admin/transit?periksa=jenis',
    },
    s.koridorTransit.tarifBelumAdmin > 0 && {
      teks: tr("{0} dari {1} koridor aktif masih memakai tarif perkiraan.", { 0: s.koridorTransit.tarifBelumAdmin, 1: s.koridorTransit.aktif }),
      to: '/admin/transit?periksa=tarif',
    },
    {
      teks: tr("Jalan utama: {0} dari {1} garis sudah dikoreksi admin{2}.", { 0: s.jalanUtama.dikoreksi, 1: s.jalanUtama.total, 2: s.jalanUtama.disembunyikan ? `, ${s.jalanUtama.disembunyikan} disembunyikan` : '' }),
      to: '/admin/jalan',
    },
  ].filter(Boolean)

  return (
    <>
      <Judul>{tr('Ringkasan')}</Judul>
      <dl ref={revealList} className="grid grid-cols-2 gap-x-6 gap-y-6 border-b border-ink/10 pb-8 md:grid-cols-3">
        {angka.map((a) => (
          <div key={a.label}>
            <dt className="text-sm text-ink/65">{a.label}</dt>
            <dd className="mt-1 font-serif text-[2.25rem] leading-none tabular-nums">
              {a.to ? (
                <Link to={a.to} className="hover:text-ink-violet">
                  <CountUp value={a.nilai} />
                </Link>
              ) : (
                <CountUp value={a.nilai} />
              )}
            </dd>
            {a.ket && <dd className="mt-1 text-xs text-ink/55">{a.ket}</dd>}
          </div>
        ))}
      </dl>
      <h2 ref={revealUp} className="mt-8 font-serif text-xl">{tr('Perlu dicek')}</h2>
      <ul ref={revealList} className="mt-2 divide-y divide-ink/[0.06]">
        {cek.map((c) => (
          <li key={c.to}>
            <Link to={c.to} className="flex min-h-touch items-center justify-between gap-4 py-3 text-[15px] hover:text-ink-violet">
              <span>{c.teks}</span>
              <span className="shrink-0 text-sm font-semibold text-ink-violet"><span className="fx-line">{tr('Buka')}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
