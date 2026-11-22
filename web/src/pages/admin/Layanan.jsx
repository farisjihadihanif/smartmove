import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import { Chip, Field, Halaman, Judul, Tombol, TombolHapus, kelasInput } from '../../components/admin/ui.jsx'
import { api } from '../../lib/api.js'
import { JENIS, labelJenis, rupiah, ruteLayanan } from '../../lib/pembayaran.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { tr } from '../../lib/i18n.js'

// Katalog pemesanan Digital Payment (PRD §6.3 "dikelola admin", T-304): moda, operator,
// asal–tujuan, jam keberangkatan, harga. Semua data simulasi.
export default function Layanan() {
  const [jenis, setJenis] = useState('')
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState(null)
  const [galat, setGalat] = useState(null)
  const { data, error, muatUlang } = useApiGet('/admin/payment-services', { jenis, page })

  return (
    <>
      <Judul aksi={!edit && <Tombol onClick={() => setEdit('baru')}>{tr('Tambah layanan')}</Tombol>}>{tr('Katalog pemesanan')}</Judul>
      {edit ? (
        <FormLayanan
          key={edit === 'baru' ? 'baru' : edit.id}
          awal={edit === 'baru' ? null : edit}
          onSelesai={() => {
            setEdit(null)
            muatUlang()
          }}
        />
      ) : (
        <>
          <label className="mb-4 flex items-center gap-2 text-sm font-semibold">
            {tr('Jenis')}
            <select
              value={jenis}
              onChange={(e) => {
                setJenis(e.target.value)
                setPage(1)
              }}
              className={`${kelasInput} w-auto`}
            >
              <option value="">{tr('Semua')}</option>
              {JENIS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </label>
          {(error || galat) && <ErrorBanner error={error || galat} onRetry={error ? muatUlang : undefined} className="mb-4" />}
          <ul className="divide-y divide-ink/[0.06]">
            {data?.items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="font-semibold">
                    {s.nama} <span className="text-xs font-normal text-ink/50">{s.kode}</span>
                  </p>
                  <p className="text-xs text-ink/60">
                    {labelJenis(s.jenis)}
                    {s.operator ? `, ${s.operator}` : ''}, {ruteLayanan(s)}
                  </p>
                  <p className="text-xs text-ink/60">
                    {rupiah(s.harga)} {tr('per')} {s.satuan}
                    {s.jadwal.length ? tr(", {0} jadwal ({1}{2})", { 0: s.jadwal.length, 1: s.jadwal.slice(0, 4).join(', '), 2: s.jadwal.length > 4 ? ', …' : '' }) : tr(', jam bebas')}
                  </p>
                </div>
                {!s.aktif && <Chip>{tr('Nonaktif')}</Chip>}
                <Tombol jenis="biasa" onClick={() => setEdit(s)}>
                  {tr('Ubah')}
                </Tombol>
                <TombolHapus
                  onHapus={async () => {
                    setGalat(null)
                    try {
                      await api.del(`/admin/payment-services/${s.id}`)
                      muatUlang()
                    } catch (e) {
                      setGalat(e)
                    }
                  }}
                />
              </li>
            ))}
          </ul>
          {data && data.items.length === 0 && <p className="mt-4 text-sm text-ink/60">{tr('Belum ada layanan. Isi awal: npm run isi:layanan di folder api.')}</p>}
          {data && <Halaman page={data.page} total={data.total} limit={50} onPage={setPage} />}
        </>
      )}
    </>
  )
}

function FormLayanan({ awal, onSelesai }) {
  const [f, setF] = useState({
    kode: awal?.kode ?? '',
    jenis: awal?.jenis ?? 'kereta',
    nama: awal?.nama ?? '',
    operator: awal?.operator ?? '',
    asal: awal?.asal ?? '',
    tujuan: awal?.tujuan ?? '',
    harga: awal?.harga ?? 10000,
    jadwal: (awal?.jadwal ?? []).join(', '),
    aktif: awal?.aktif ?? true,
  })
  const [kirim, setKirim] = useState({ jalan: false, error: null })
  const ubah = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const parkir = f.jenis === 'parkir'

  async function simpan(e) {
    e.preventDefault()
    setKirim({ jalan: true, error: null })
    const body = {
      jenis: f.jenis,
      nama: f.nama,
      operator: f.operator,
      asal: f.asal,
      tujuan: parkir ? '' : f.tujuan,
      harga: Number(f.harga),
      jadwal: f.jadwal
        .split(/[\s,]+/)
        .map((j) => j.trim().replace('.', ':'))
        .filter(Boolean),
      aktif: f.aktif,
    }
    try {
      if (awal) await api.patch(`/admin/payment-services/${awal.id}`, body)
      else await api.post('/admin/payment-services', { ...body, kode: f.kode })
      onSelesai()
    } catch (error) {
      setKirim({ jalan: false, error })
    }
  }

  return (
    <form onSubmit={simpan} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <Field label={tr('Kode')} hint={awal ? tr('Kode tidak bisa diubah.') : tr('Huruf, angka, tanda hubung (mis. TRAVEL-TOBA).')}>
        <input value={f.kode} onChange={ubah('kode')} required disabled={!!awal} maxLength={30} className={`${kelasInput} uppercase disabled:opacity-60`} />
      </Field>
      <Field label={tr('Jenis')}>
        <select value={f.jenis} onChange={ubah('jenis')} className={kelasInput}>
          {JENIS.map((j) => (
            <option key={j.value} value={j.value}>
              {j.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tr('Nama layanan')} className="sm:col-span-2">
        <input value={f.nama} onChange={ubah('nama')} required maxLength={120} className={kelasInput} />
      </Field>
      <Field label={tr('Operator (opsional)')}>
        <input value={f.operator} onChange={ubah('operator')} maxLength={80} className={kelasInput} />
      </Field>
      <Field label={parkir ? tr('Harga per jam (Rp)') : tr('Harga per orang (Rp)')}>
        <input type="number" min={1} step={1} value={f.harga} onChange={ubah('harga')} required className={kelasInput} />
      </Field>
      <Field label={parkir ? tr('Lokasi parkir') : tr('Asal')}>
        <input value={f.asal} onChange={ubah('asal')} maxLength={120} className={kelasInput} />
      </Field>
      {!parkir && (
        <Field label={tr('Tujuan')}>
          <input value={f.tujuan} onChange={ubah('tujuan')} maxLength={120} className={kelasInput} />
        </Field>
      )}
      <Field
        label={tr('Jam keberangkatan (WIB)')}
        hint={parkir ? tr('Kosongkan: parkir bisa mulai jam berapa saja.') : tr('Pisahkan dengan koma, mis. 06:40, 08:00, 09:45.')}
        className="sm:col-span-2"
      >
        <input value={f.jadwal} onChange={ubah('jadwal')} className={kelasInput} placeholder="06:40, 08:00" />
      </Field>
      <label className="flex min-h-touch items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={f.aktif} onChange={ubah('aktif')} className="size-5 accent-[color:var(--color-pill-via)]" />
        {tr('Bisa dipesan')}
      </label>
      {kirim.error && <ErrorBanner error={kirim.error} className="sm:col-span-2" />}
      <div className="flex gap-3 sm:col-span-2">
        <Tombol type="submit" memuat={kirim.jalan}>
          {awal ? tr('Simpan perubahan') : tr('Tambah layanan')}
        </Tombol>
        <Tombol jenis="biasa" onClick={onSelesai}>
          {tr('Batal')}
        </Tombol>
      </div>
    </form>
  )
}
