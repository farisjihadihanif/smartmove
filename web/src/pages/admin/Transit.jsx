import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import SearchField from '../../components/SearchField.jsx'
import PetaAdmin from '../../components/admin/PetaAdmin.jsx'
import { Chip, Field, Judul, Tombol, TombolHapus, kelasInput } from '../../components/admin/ui.jsx'
import { api } from '../../lib/api.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { tr, locale } from '../../lib/i18n.js'

// Koridor & halte transportasi umum. Data utama dari OSM; admin membetulkan tarif
// (→ label "Tarif perkiraan" hilang), jenis (TMD yang tercatat angkot), halte, atau menyembunyikan koridor.

const JENIS = { bus: tr('Bus'), kereta: tr('Kereta'), angkot: tr('Angkot') }
const rupiah = (n) => (n == null ? '–' : `Rp${n.toLocaleString(locale)}`)

export default function Transit() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [cari, setCari] = useState('')
  const periksa = params.get('periksa') ?? ''
  const id = params.get('id')
  const daftar = useApiGet('/admin/transit/lines', { q: cari, periksa })
  const atur = (ubah) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      for (const [k, v] of Object.entries(ubah)) {
        if (v) n.set(k, v)
        else n.delete(k)
      }
      return n
    })

  if (id) {
    const kembali = () => {
      atur({ id: null })
      daftar.muatUlang()
    }
    return <Detail id={id} onKembali={kembali} />
  }

  return (
    <>
      <Judul>{tr('Koridor & halte')}</Judul>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-sm">
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v)
              if (!v) setCari('')
            }}
            onSubmit={(v) => setCari(v.trim())}
            placeholder={tr('Kode, nama, atau operator')}
            label={tr('Cari koridor')}
          />
        </div>
        <select value={periksa} onChange={(e) => atur({ periksa: e.target.value })} aria-label={tr('Saring')} className={`${kelasInput} w-auto`}>
          <option value="">{tr('Semua koridor')}</option>
          <option value="tarif">{tr('Tarif masih perkiraan')}</option>
          <option value="jenis">{tr('TMD tercatat angkot')}</option>
        </select>
      </div>
      {daftar.error && <ErrorBanner error={daftar.error} onRetry={daftar.muatUlang} className="mb-4" />}
      <ul className="divide-y divide-ink/[0.06]">
        {daftar.data?.items.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => atur({ id: l.id })}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-3 text-left hover:bg-ink/[0.035]"
            >
              <span aria-hidden="true" className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: l.warna ?? '#A2028A' }} />
              <span className="min-w-0 flex-1 basis-56">
                <span className="block font-semibold">
                  {l.kode} <span className="font-normal text-ink/70">{l.nama}</span>
                </span>
                <span className="block text-xs text-ink/60">
                  {JENIS[l.jenis]}, {l.jumlahHalte} {tr('halte,')} {rupiah(l.tarif)}
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {l.periksaJenis && <Chip nada="kuning">{tr('Periksa jenis')}</Chip>}
                {l.tarifPerkiraan && <Chip nada="kuning">{tr('Tarif perkiraan')}</Chip>}
                {l.dikoreksiAdmin && <Chip nada="ungu">{tr('Dikoreksi admin')}</Chip>}
                {!l.aktif && <Chip nada="merah">{tr('Disembunyikan')}</Chip>}
                <Chip>{l.sumber === 'osm' ? tr('OSM') : tr('Buatan admin')}</Chip>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {daftar.data && daftar.data.items.length === 0 && <p className="mt-2 text-sm text-ink/60">{tr('Tidak ada koridor yang cocok.')}</p>}
    </>
  )
}

function Detail({ id, onKembali }) {
  const { data, error, muatUlang } = useApiGet(`/admin/transit/lines/${id}`)
  const l = data?.line
  return (
    <>
      <Judul aksi={<Tombol jenis="biasa" onClick={onKembali}>{tr('Kembali ke daftar')}</Tombol>}>{l ? `${l.kode}` : tr('Koridor')}</Judul>
      {error && <ErrorBanner error={error} onRetry={muatUlang} />}
      {l && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <FormKoridor key={l.diperbaruiPada} l={l} onSimpan={muatUlang} />
          <Halte l={l} onUbah={muatUlang} />
        </div>
      )}
    </>
  )
}

function FormKoridor({ l, onSimpan }) {
  const [f, setF] = useState({
    nama: l.nama,
    jenis: l.jenis,
    operator: l.operator ?? '',
    warna: l.warna ?? '',
    tarif: l.tarifAdmin ?? '',
    kecepatanRataKmj: l.kecepatanRataKmj,
    jamOperasi: l.jamOperasi ?? '',
  })
  const [status, setStatus] = useState({ memuat: false, error: null, pesan: '' })
  const ubah = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function kirim(body, pesan) {
    setStatus({ memuat: true, error: null, pesan: '' })
    try {
      await api.patch(`/admin/transit/lines/${l.id}`, body)
      setStatus({ memuat: false, error: null, pesan })
      onSimpan()
    } catch (error) {
      setStatus({ memuat: false, error, pesan: '' })
    }
  }

  function simpan(e) {
    e.preventDefault()
    const body = {}
    if (f.nama !== l.nama) body.nama = f.nama
    if (f.jenis !== l.jenis) body.jenis = f.jenis
    if (f.operator !== (l.operator ?? '')) body.operator = f.operator
    if (f.warna !== (l.warna ?? '')) body.warna = f.warna || null
    if (f.jamOperasi !== (l.jamOperasi ?? '')) body.jamOperasi = f.jamOperasi
    if (Number(f.kecepatanRataKmj) !== l.kecepatanRataKmj) body.kecepatanRataKmj = Number(f.kecepatanRataKmj)
    const tarif = f.tarif === '' ? null : Number(f.tarif)
    if (tarif !== l.tarifAdmin || (tarif !== null && l.tarifSumber !== 'admin')) body.tarif = tarif
    if (!Object.keys(body).length) return setStatus({ memuat: false, error: null, pesan: tr('Tidak ada perubahan.') })
    kirim(body, tr('Perubahan disimpan.'))
  }

  return (
    <form onSubmit={simpan} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <Chip>{l.sumber === 'osm' ? `OSM ${l.osmId ?? ''}` : tr('Buatan admin')}</Chip>
        {l.dikoreksiAdmin && <Chip nada="ungu">{tr('Dikoreksi admin, impor OSM tidak menimpa')}</Chip>}
        {l.periksaJenis && <Chip nada="kuning">{tr('Trans Metro Deli tercatat angkot')}</Chip>}
        {!l.aktif && <Chip nada="merah">{tr('Disembunyikan')}</Chip>}
      </div>
      <Field label={tr('Nama')}>
        <input required maxLength={150} value={f.nama} onChange={ubah('nama')} className={kelasInput} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={tr('Jenis')} hint={l.periksaJenis ? tr('Trans Metro Deli seharusnya Bus.') : undefined}>
          <select value={f.jenis} onChange={ubah('jenis')} className={kelasInput}>
            {Object.entries(JENIS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr('Warna garis')}>
          <input value={f.warna} onChange={ubah('warna')} placeholder="#A2028A" pattern="#[0-9a-fA-F]{6}" className={kelasInput} />
        </Field>
      </div>
      <Field label={tr('Operator')}>
        <input maxLength={100} value={f.operator} onChange={ubah('operator')} className={kelasInput} />
      </Field>
      <Field
        label={tr('Tarif resmi (Rp)')}
        hint={
          l.tarifSumber === 'admin'
            ? tr('Diisi admin, tampil tanpa label perkiraan.')
            : tr("Kosong = memakai perkiraan {0} dengan label \"Tarif perkiraan\".", { 0: rupiah(l.tarif) })
        }
      >
        <input type="number" min={0} max={1000000} step={500} value={f.tarif} onChange={ubah('tarif')} className={kelasInput} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={tr('Kecepatan rata-rata (km/j)')}>
          <input type="number" min={1} max={120} value={f.kecepatanRataKmj} onChange={ubah('kecepatanRataKmj')} className={kelasInput} />
        </Field>
        <Field label={tr('Jam operasi')}>
          <input maxLength={40} value={f.jamOperasi} onChange={ubah('jamOperasi')} placeholder="05.30–21.00" className={kelasInput} />
        </Field>
      </div>
      {status.error && <ErrorBanner error={status.error} />}
      {status.pesan && (
        <p role="status" className="text-sm font-semibold text-[#1B6B3C]">
          {status.pesan}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Tombol type="submit" memuat={status.memuat}>
          {tr('Simpan')}
        </Tombol>
        <Tombol jenis="biasa" onClick={() => kirim({ aktif: !l.aktif }, l.aktif ? tr('Koridor disembunyikan.') : tr('Koridor ditampilkan lagi.'))}>
          {l.aktif ? tr('Sembunyikan') : tr('Tampilkan lagi')}
        </Tombol>
        {l.sumber === 'osm' && l.dikoreksiAdmin && (
          <Tombol jenis="biasa" onClick={() => kirim({ kembalikanOsm: true }, tr('Impor OSM berikutnya akan memperbarui koridor ini lagi.'))}>
            {tr('Kembalikan ke data OSM')}
          </Tombol>
        )}
      </div>
    </form>
  )
}

function Halte({ l, onUbah }) {
  const [pilih, setPilih] = useState(null)
  const [tambah, setTambah] = useState(false)
  const [baru, setBaru] = useState(null) // { lokasi, nama }
  const [galat, setGalat] = useState(null)
  const warna = l.warna ?? '#A2028A'

  async function aksi(fn) {
    setGalat(null)
    try {
      await fn()
      onUbah()
    } catch (e) {
      setGalat(e)
    }
  }

  const tukar = (i, j) =>
    aksi(async () => {
      const a = l.halte[i]
      const b = l.halte[j]
      await api.patch(`/admin/transit/stops/${a.id}`, { line: l.id, urutan: b.urutan })
      await api.patch(`/admin/transit/stops/${b.id}`, { line: l.id, urutan: a.urutan })
    })

  return (
    <section aria-label={tr('Halte koridor')} className="min-w-0">
      <PetaAdmin
        garis={l.garis}
        warnaGaris={warna}
        penanda={[
          ...l.halte.map((h) => ({ id: h.id, lokasi: h.lokasi, judul: h.nama, warna, aktif: h.id === pilih })),
          ...(baru ? [{ id: 'baru', lokasi: baru.lokasi, judul: tr('Halte baru'), warna: '#41396F', aktif: true }] : []),
        ]}
        onGeser={(hid, lokasi) =>
          hid === 'baru' ? setBaru((b) => ({ ...b, lokasi })) : aksi(() => api.patch(`/admin/transit/stops/${hid}`, { lokasi }))
        }
        onPilih={setPilih}
        onPick={tambah ? (lokasi) => setBaru((b) => ({ nama: b?.nama ?? '', lokasi })) : undefined}
        kunci={l.id}
        label={tr("Peta koridor {0}", { 0: l.kode })}
      />
      <p className="mt-2 text-xs text-ink/60">{tr('Geser penanda untuk memindahkan halte. Halte yang diubah tidak ditimpa impor OSM.')}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {!tambah ? (
          <Tombol jenis="biasa" onClick={() => setTambah(true)}>
            {tr('Tambah halte')}
          </Tombol>
        ) : (
          <>
            <Field label={baru ? tr('Nama halte baru') : tr('Ketuk peta untuk menaruh halte baru')} className="min-w-56 flex-1">
              <input
                disabled={!baru}
                value={baru?.nama ?? ''}
                onChange={(e) => setBaru((b) => ({ ...b, nama: e.target.value }))}
                maxLength={150}
                className={kelasInput}
              />
            </Field>
            <Tombol
              disabled={!baru?.nama?.trim()}
              onClick={() =>
                aksi(async () => {
                  await api.post('/admin/transit/stops', { nama: baru.nama, lokasi: baru.lokasi, line: l.id })
                  setBaru(null)
                  setTambah(false)
                })
              }
            >
              {tr('Simpan halte')}
            </Tombol>
            <Tombol
              jenis="biasa"
              onClick={() => {
                setBaru(null)
                setTambah(false)
              }}
            >
              {tr('Batal')}
            </Tombol>
          </>
        )}
      </div>
      {galat && <ErrorBanner error={galat} className="mt-3" />}
      <h2 className="mt-6 font-serif text-xl">{tr('Halte (')}{l.halte.length})</h2>
      {l.halte.length === 0 && (
        <p className="mt-1 text-sm text-ink/60">{tr('Koridor tanpa halte (angkot): penumpang naik/turun di sepanjang jalan.')}</p>
      )}
      <ol className="mt-2 divide-y divide-ink/[0.06]">
        {l.halte.map((h, i) => (
          <li key={h.id} className={`flex flex-wrap items-center gap-2 py-2 ${h.id === pilih ? 'bg-lilac-wash/25' : ''}`}>
            <span className="w-7 text-right text-xs tabular-nums text-ink/50">{i + 1}.</span>
            <NamaHalte h={h} onSimpan={(nama) => aksi(() => api.patch(`/admin/transit/stops/${h.id}`, { nama }))} />
            {h.sumber === 'osm' && !h.dikoreksiAdmin && <Chip>{tr('OSM')}</Chip>}
            {h.jumlahKoridor > 1 && <Chip>{h.jumlahKoridor} {tr('koridor')}</Chip>}
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                aria-label={tr('Naikkan {0}', { 0: h.nama })}
                disabled={i === 0}
                onClick={() => tukar(i, i - 1)}
                className="grid size-touch place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30"
              >
                <ArrowUp size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={tr('Turunkan {0}', { 0: h.nama })}
                disabled={i === l.halte.length - 1}
                onClick={() => tukar(i, i + 1)}
                className="grid size-touch place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30"
              >
                <ArrowDown size={18} aria-hidden="true" />
              </button>
              <TombolHapus label={tr('Lepas')} onHapus={() => aksi(() => api.del(`/admin/transit/stops/${h.id}?line=${l.id}`))} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function NamaHalte({ h, onSimpan }) {
  const [nama, setNama] = useState(h.nama)
  return (
    <input
      value={nama}
      aria-label={tr("Nama halte {0}", { 0: h.nama })}
      onChange={(e) => setNama(e.target.value)}
      onBlur={() => nama.trim() && nama !== h.nama && onSimpan(nama)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      maxLength={150}
      className="min-h-touch min-w-0 flex-1 basis-40 rounded-lg bg-transparent px-2 text-[15px] outline-none hover:bg-search focus:bg-search focus:ring-2 focus:ring-pill-via"
    />
  )
}
