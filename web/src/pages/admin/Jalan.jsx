import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PetaAdmin from '../../components/admin/PetaAdmin.jsx'
import { Chip, Field, Judul, Tombol, kelasInput } from '../../components/admin/ui.jsx'
import { api } from '../../lib/api.js'
import { formatKm } from '../../lib/lalulintas.js'
import { useApiGet } from '../../lib/useApiGet.js'

// Jalan utama (RoadCorridor) untuk Estimasi Waktu Live Traffic. Geometri otomatis dari OSM
// (`npm run impor:jalan`); admin hanya membetulkan garis yang salah atau menyembunyikannya.
export default function Jalan() {
  const { data, error, muatUlang } = useApiGet('/admin/road-corridors')
  const [pilihKode, setPilihKode] = useState(null)
  const items = data?.items ?? []
  const k = items.find((x) => x.kode === pilihKode) ?? null

  return (
    <>
      <Judul>Jalan utama</Judul>
      <p className="-mt-3 mb-5 max-w-[65ch] text-sm leading-relaxed text-ink/65">
        Garis diambil otomatis dari OpenStreetMap. Ubah hanya bila salah: garis yang dikoreksi tidak ditimpa impor berikutnya.
      </p>
      {error && <ErrorBanner error={error} onRetry={muatUlang} className="mb-4" />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <ul aria-label="Daftar jalan utama" className="divide-y divide-ink/[0.06] self-start">
          {items.map((x) => (
            <li key={x.kode}>
              <button
                type="button"
                aria-pressed={x.kode === pilihKode}
                onClick={() => setPilihKode(x.kode)}
                className={`flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition ${
                  x.kode === pilihKode ? 'bg-lilac-wash/35' : 'hover:bg-ink/[0.035]'
                }`}
              >
                <span className="font-semibold">{x.nama}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Chip>{formatKm(x.panjangM)}</Chip>
                  {x.dikoreksiAdmin ? <Chip nada="ungu">Dikoreksi admin</Chip> : <Chip>OSM</Chip>}
                  {!x.aktif && <Chip nada="kuning">Disembunyikan</Chip>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {k ? (
          <Editor key={k.kode + k.diperbaruiPada} k={k} onSimpan={muatUlang} />
        ) : (
          <p className="text-sm text-ink/60">{items.length ? 'Pilih jalan untuk melihat dan mengoreksi garisnya.' : 'Memuat…'}</p>
        )}
      </div>
    </>
  )
}

function Editor({ k, onSimpan }) {
  const [garis, setGaris] = useState(k.garis)
  const [nama, setNama] = useState(k.nama)
  const [tambah, setTambah] = useState(false)
  const [status, setStatus] = useState({ memuat: false, error: null, pesan: '' })
  const garisBerubah = JSON.stringify(garis) !== JSON.stringify(k.garis)

  async function simpan(body, pesan) {
    setStatus({ memuat: true, error: null, pesan: '' })
    try {
      await api.patch(`/admin/road-corridors/${k.kode}`, body)
      setStatus({ memuat: false, error: null, pesan })
      onSimpan()
    } catch (error) {
      setStatus({ memuat: false, error, pesan: '' })
    }
  }

  return (
    <section aria-label={`Koreksi ${k.nama}`} className="min-w-0">
      <PetaAdmin
        garis={garis}
        editGaris
        onGaris={setGaris}
        onPick={tambah ? (p) => setGaris((g) => [...g, [p.lng, p.lat]]) : undefined}
        kunci={k.kode}
        label={`Peta ${k.nama}`}
      />
      <p className="mt-2 text-xs leading-relaxed text-ink/60">
        Geser titik putih untuk memindahkan garis. {tambah ? 'Ketuk peta untuk menambah titik di ujung garis.' : ''} {garis.length} titik.
        {k.namaOsm.length > 0 && ` Ruas OSM: ${k.namaOsm.join(', ')}.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Tombol jenis="biasa" aria-pressed={tambah} onClick={() => setTambah((t) => !t)}>
          {tambah ? 'Selesai menambah' : 'Tambah titik'}
        </Tombol>
        <Tombol jenis="biasa" disabled={garis.length <= 2} onClick={() => setGaris((g) => g.slice(0, -1))}>
          Hapus titik terakhir
        </Tombol>
        <Tombol jenis="biasa" disabled={!garisBerubah} onClick={() => setGaris(k.garis)}>
          Batalkan perubahan
        </Tombol>
        <Tombol memuat={status.memuat} disabled={!garisBerubah} onClick={() => simpan({ garis }, 'Garis disimpan.')}>
          Simpan garis
        </Tombol>
      </div>

      <div className="mt-6 grid gap-4 border-t border-ink/10 pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Nama di aplikasi">
          <input value={nama} onChange={(e) => setNama(e.target.value)} className={kelasInput} maxLength={100} />
        </Field>
        <Tombol jenis="biasa" disabled={!nama.trim() || nama === k.nama} onClick={() => simpan({ nama }, 'Nama disimpan.')}>
          Simpan nama
        </Tombol>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Tombol jenis="biasa" onClick={() => simpan({ aktif: !k.aktif }, k.aktif ? 'Jalan disembunyikan.' : 'Jalan ditampilkan lagi.')}>
          {k.aktif ? 'Sembunyikan dari aplikasi' : 'Tampilkan lagi'}
        </Tombol>
        {k.dikoreksiAdmin && (
          <Tombol jenis="biasa" onClick={() => simpan({ kembalikanOsm: true }, 'Impor berikutnya akan memakai garis OSM lagi.')}>
            Kembalikan ke data OSM
          </Tombol>
        )}
      </div>
      {status.error && <ErrorBanner error={status.error} className="mt-3" />}
      {status.pesan && (
        <p role="status" className="mt-3 text-sm font-semibold text-[#1B6B3C]">
          {status.pesan}
        </p>
      )}
    </section>
  )
}
