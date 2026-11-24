import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PillToggle from '../../components/PillToggle.jsx'
import { Chip, Halaman, Judul, Tabel, TombolHapus } from '../../components/admin/ui.jsx'
import { api } from '../../lib/api.js'
import { KEJADIAN, TINGKAT } from '../../lib/lalulintas.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { jamAtauTanggal } from '../../lib/wib.js'
import { tr } from '../../lib/i18n.js'

const NADA = { lancar: 'hijau', padat: 'kuning', macet: 'merah' }

// Moderasi laporan lalu lintas: lihat pelapor, hapus laporan palsu/menyesatkan.
export default function Laporan() {
  const [status, setStatus] = useState('aktif')
  const [page, setPage] = useState(1)
  const [galat, setGalat] = useState(null)
  const { data, error, muatUlang } = useApiGet('/admin/traffic/reports', { status, page })
  const [now] = useState(() => Date.now())

  return (
    <>
      <Judul
        aksi={
          <PillToggle
            options={[
              { value: 'aktif', label: tr('Aktif') },
              { value: 'semua', label: tr('Semua') },
            ]}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            label={tr('Saring laporan')}
            fitDesktop
          />
        }
      >
        {tr('Laporan lalu lintas')}
      </Judul>
      {(error || galat) && <ErrorBanner error={error || galat} onRetry={error ? muatUlang : undefined} className="mb-4" />}
      <Tabel label={tr('Laporan lalu lintas')} kolom={[tr('Kondisi'), tr('Catatan'), tr('Pelapor'), tr('Waktu'), tr('Lokasi'), '']}>
        {data?.items.map((r) => (
          <tr key={r.id}>
            <td className="px-3 py-3">
              <Chip nada={NADA[r.tingkat]}>{TINGKAT[r.tingkat]?.label}</Chip>
              {r.kejadian !== 'none' && <span className="mt-1 block text-xs font-semibold text-[#B71C1C]">{KEJADIAN[r.kejadian]}</span>}
            </td>
            <td className="max-w-[18rem] px-3 py-3 text-ink/80">{r.catatan || <span className="text-ink/40">–</span>}</td>
            <td className="px-3 py-3">
              {r.pelapor?.username ?? <span className="text-ink/40">{tr('akun dihapus')}</span>}
              {r.konfirmasi > 0 && <span className="block text-xs text-ink/55">+{r.konfirmasi} {tr('konfirmasi')}</span>}
            </td>
            <td className="px-3 py-3 text-ink/65">
              {jamAtauTanggal(r.createdAt, now)}
              {new Date(r.expiresAt) < now && <span className="block text-xs">{tr('kedaluwarsa')}</span>}
            </td>
            <td className="px-3 py-3">
              <a
                href={`https://www.openstreetmap.org/?mlat=${r.lokasi.lat}&mlon=${r.lokasi.lng}#map=17/${r.lokasi.lat}/${r.lokasi.lng}`}
                target="_blank"
                rel="noreferrer"
                className="fx-line font-semibold text-ink-violet"
              >
                {tr('Lihat peta')}
              </a>
            </td>
            <td className="px-3 py-2 text-right">
              <TombolHapus
                onHapus={async () => {
                  setGalat(null)
                  try {
                    await api.del(`/admin/traffic/reports/${r.id}`)
                    muatUlang()
                  } catch (e) {
                    setGalat(e)
                  }
                }}
              />
            </td>
          </tr>
        ))}
      </Tabel>
      {data && data.items.length === 0 && <p className="mt-4 text-sm text-ink/60">{tr('Tidak ada laporan.')}</p>}
      {data && <Halaman page={data.page} total={data.total} onPage={setPage} />}
    </>
  )
}
