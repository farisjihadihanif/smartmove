import { useState } from 'react'
import { ImageIcon } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PillToggle from '../../components/PillToggle.jsx'
import Rambu from '../../components/kampanye/Rambu.jsx'
import { Chip, Field, Judul, Tombol, TombolHapus, kelasInput } from '../../components/admin/ui.jsx'
import { api, fileUrl } from '../../lib/api.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { tr } from '../../lib/i18n.js'

// Kelola konten kampanye: tips keselamatan dan poster (gambar JPG/PNG/WEBP ≤ 3 MB).
export default function Konten() {
  const [jenis, setJenis] = useState('tips')
  const [edit, setEdit] = useState(null) // null | 'baru' | konten
  const { data, error, muatUlang } = useApiGet('/admin/contents', { jenis })
  const items = data?.items ?? []

  return (
    <>
      <Judul aksi={!edit && <Tombol onClick={() => setEdit('baru')}>{jenis === 'tips' ? tr('Tambah tips') : tr('Tambah poster')}</Tombol>}>
        {tr('Tips & poster')}
      </Judul>
      {!edit && (
        <PillToggle
          options={[
            { value: 'tips', label: tr('Tips Keselamatan') },
            { value: 'poster', label: tr('Poster') },
          ]}
          value={jenis}
          onChange={setJenis}
          label={tr('Jenis konten')}
          fitDesktop
          className="mb-4"
        />
      )}
      {error && <ErrorBanner error={error} onRetry={muatUlang} className="mb-4" />}
      {edit ? (
        <FormKonten
          key={edit === 'baru' ? 'baru' : edit.id}
          jenis={jenis}
          awal={edit === 'baru' ? null : edit}
          urutanBaru={items.length + 1}
          onSelesai={() => {
            setEdit(null)
            muatUlang()
          }}
        />
      ) : (
        <ul className="divide-y divide-ink/[0.06]">
          {items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              {c.jenis === 'poster' ? (
                c.gambar ? (
                  <img src={fileUrl(c.gambar)} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover ring-1 ring-ink/10" />
                ) : (
                  <ImageIcon size={28} className="text-ink/30" aria-hidden="true" />
                )
              ) : (
                <Rambu kecil />
              )}
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-semibold">{c.judul}</p>
                {c.isi && <p className="line-clamp-1 text-xs text-ink/60">{c.isi}</p>}
              </div>
              <Chip>{tr('Urutan')} {c.urutan}</Chip>
              {!c.aktif && <Chip nada="kuning">{tr('Disembunyikan')}</Chip>}
              <Tombol jenis="biasa" onClick={() => setEdit(c)}>
                {tr('Ubah')}
              </Tombol>
              <TombolHapus
                onHapus={async () => {
                  await api.del(`/admin/contents/${c.id}`)
                  muatUlang()
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {!edit && data && items.length === 0 && <p className="mt-2 text-sm text-ink/60">{tr('Belum ada')} {jenis === 'tips' ? 'tips' : 'poster'}.</p>}
    </>
  )
}

function FormKonten({ jenis, awal, urutanBaru, onSelesai }) {
  const [f, setF] = useState({
    judul: awal?.judul ?? '',
    isi: awal?.isi ?? '',
    urutan: awal?.urutan ?? urutanBaru,
    aktif: awal?.aktif ?? true,
  })
  const [berkas, setBerkas] = useState(null)
  const [pratinjau, setPratinjau] = useState(awal?.gambar ? fileUrl(awal.gambar) : null)
  const [status, setStatus] = useState({ memuat: false, error: null })
  const poster = (awal?.jenis ?? jenis) === 'poster'

  async function simpan(e) {
    e.preventDefault()
    setStatus({ memuat: true, error: null })
    const fd = new FormData()
    if (!awal) fd.append('jenis', jenis)
    fd.append('judul', f.judul)
    fd.append('isi', f.isi)
    fd.append('urutan', String(f.urutan))
    fd.append('aktif', String(f.aktif))
    if (berkas) fd.append('gambar', berkas)
    try {
      if (awal) await api.patch(`/admin/contents/${awal.id}`, fd)
      else await api.post('/admin/contents', fd)
      onSelesai()
    } catch (error) {
      setStatus({ memuat: false, error })
    }
  }

  return (
    <form onSubmit={simpan} className="flex max-w-xl flex-col gap-4">
      <h2 className="font-serif text-xl">{awal ? tr('Ubah') : tr('Tambah')} {poster ? 'poster' : 'tips'}</h2>
      <Field label={tr('Judul')}>
        <input required maxLength={150} value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} className={kelasInput} />
      </Field>
      <Field label={poster ? tr('Keterangan (boleh kosong)') : tr('Isi tips')}>
        <textarea
          required={!poster}
          maxLength={2000}
          rows={4}
          value={f.isi}
          onChange={(e) => setF({ ...f, isi: e.target.value })}
          className={`${kelasInput} py-2.5`}
        />
      </Field>
      {poster && (
        <Field label={tr('Gambar poster')} hint={tr('JPG, PNG, atau WEBP, maksimal 3 MB.')}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={!awal}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              setBerkas(file)
              if (file) setPratinjau(URL.createObjectURL(file))
            }}
            className="block w-full text-sm file:mr-3 file:min-h-touch file:rounded-full file:border-0 file:bg-lilac-wash/50 file:px-4 file:font-semibold file:text-ink-violet"
          />
          {pratinjau && <img src={pratinjau} alt={tr('Pratinjau poster')} className="mt-3 max-h-64 rounded-xl ring-1 ring-ink/10" />}
        </Field>
      )}
      <div className="flex flex-wrap items-end gap-6">
        <Field label={tr('Urutan')} className="w-28">
          <input
            type="number"
            min={0}
            max={10000}
            value={f.urutan}
            onChange={(e) => setF({ ...f, urutan: Number(e.target.value) })}
            className={kelasInput}
          />
        </Field>
        <label className="flex min-h-touch items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.aktif} onChange={(e) => setF({ ...f, aktif: e.target.checked })} className="size-5 accent-pill-via" />
          {tr('Tampilkan di aplikasi')}
        </label>
      </div>
      {status.error && <ErrorBanner error={status.error} />}
      <div className="flex flex-wrap gap-2">
        <Tombol type="submit" memuat={status.memuat}>
          {tr('Simpan')}
        </Tombol>
        <Tombol jenis="biasa" onClick={onSelesai}>
          {tr('Batal')}
        </Tombol>
      </div>
    </form>
  )
}
