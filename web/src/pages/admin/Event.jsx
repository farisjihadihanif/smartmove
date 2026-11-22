import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PillToggle from '../../components/PillToggle.jsx'
import PetaAdmin from '../../components/admin/PetaAdmin.jsx'
import { Chip, Field, Halaman, Judul, Tombol, TombolHapus, kelasInput } from '../../components/admin/ui.jsx'
import { api } from '../../lib/api.js'
import { JENIS_EVENT, infoJenisEvent, rentangEvent } from '../../lib/kampanye.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { dariInputWib, keInputWib } from '../../lib/wib.js'
import { tr } from '../../lib/i18n.js'

// Kelola EventAlert: daftar + form dengan lokasi dipilih di peta (opsional).
export default function Event() {
  const [status, setStatus] = useState('aktif')
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState(null) // null | 'baru' | event
  const { data, error, muatUlang } = useApiGet('/admin/events', { status, page })
  const [now] = useState(() => Date.now())

  return (
    <>
      <Judul aksi={!edit && <Tombol onClick={() => setEdit('baru')}>{tr('Tambah event')}</Tombol>}>{tr('EventAlert')}</Judul>
      {edit ? (
        <FormEvent
          key={edit === 'baru' ? 'baru' : edit.id}
          awal={edit === 'baru' ? null : edit}
          onSelesai={() => {
            setEdit(null)
            muatUlang()
          }}
        />
      ) : (
        <>
          <PillToggle
            options={[
              { value: 'aktif', label: tr('Berlangsung & mendatang') },
              { value: 'selesai', label: tr('Sudah selesai') },
            ]}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            label={tr('Saring event')}
            fitDesktop
            className="mb-4"
          />
          {error && <ErrorBanner error={error} onRetry={muatUlang} className="mb-4" />}
          <ul className="divide-y divide-ink/[0.06]">
            {data?.items.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: infoJenisEvent(e.jenis).warna }} />
                <div className="min-w-0 flex-1 basis-60">
                  <p className="font-semibold">{e.judul}</p>
                  <p className="text-xs text-ink/60">
                    {infoJenisEvent(e.jenis).label}, {rentangEvent(e, now)}
                  </p>
                </div>
                {e.status === 'berlangsung' && <Chip nada="hijau">{tr('Berlangsung')}</Chip>}
                {!e.lokasi && <Chip>{tr('Tanpa lokasi')}</Chip>}
                <Tombol jenis="biasa" onClick={() => setEdit(e)}>
                  {tr('Ubah')}
                </Tombol>
                <TombolHapus
                  onHapus={async () => {
                    await api.del(`/admin/events/${e.id}`)
                    muatUlang()
                  }}
                />
              </li>
            ))}
          </ul>
          {data && data.items.length === 0 && <p className="mt-2 text-sm text-ink/60">{tr('Belum ada event di sini.')}</p>}
          {data && <Halaman page={data.page} total={data.total} onPage={setPage} />}
        </>
      )}
    </>
  )
}

function FormEvent({ awal, onSelesai }) {
  const [f, setF] = useState({
    judul: awal?.judul ?? '',
    isi: awal?.isi ?? '',
    jenis: awal?.jenis ?? 'cfd',
    mulai: keInputWib(awal?.mulai),
    selesai: keInputWib(awal?.selesai),
    lokasi: awal?.lokasi ?? null,
  })
  const [status, setStatus] = useState({ memuat: false, error: null })
  const ubah = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function simpan(e) {
    e.preventDefault()
    setStatus({ memuat: true, error: null })
    const body = { ...f, mulai: dariInputWib(f.mulai), selesai: dariInputWib(f.selesai) }
    try {
      if (awal) await api.patch(`/admin/events/${awal.id}`, body)
      else await api.post('/admin/events', body)
      onSelesai()
    } catch (error) {
      setStatus({ memuat: false, error })
    }
  }

  return (
    <form onSubmit={simpan} className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-xl">{awal ? tr('Ubah event') : tr('Event baru')}</h2>
        <Field label={tr('Judul')}>
          <input required maxLength={150} value={f.judul} onChange={ubah('judul')} className={kelasInput} placeholder={tr('Car Free Day Jl. Pemuda')} />
        </Field>
        <Field label={tr('Jenis')}>
          <select value={f.jenis} onChange={ubah('jenis')} className={kelasInput}>
            {Object.entries(JENIS_EVENT).map(([v, j]) => (
              <option key={v} value={v}>
                {j.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tr('Mulai (WIB)')}>
            <input required type="datetime-local" value={f.mulai} onChange={ubah('mulai')} className={kelasInput} />
          </Field>
          <Field label={tr('Selesai (WIB)')}>
            <input required type="datetime-local" value={f.selesai} onChange={ubah('selesai')} className={kelasInput} />
          </Field>
        </div>
        <Field label={tr('Isi')} hint={tr('Jelaskan jalan yang terdampak dan jalan alternatif.')}>
          <textarea required maxLength={2000} rows={4} value={f.isi} onChange={ubah('isi')} className={`${kelasInput} py-2.5`} />
        </Field>
        {status.error && <ErrorBanner error={status.error} />}
        <div className="flex flex-wrap gap-2">
          <Tombol type="submit" memuat={status.memuat}>
            {tr('Simpan event')}
          </Tombol>
          <Tombol jenis="biasa" onClick={onSelesai}>
            {tr('Batal')}
          </Tombol>
        </div>
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-sm font-semibold">{tr('Lokasi di peta (boleh kosong)')}</p>
        <PetaAdmin
          penanda={f.lokasi ? [{ id: 'e', lokasi: f.lokasi, judul: f.judul || tr('Lokasi event'), warna: infoJenisEvent(f.jenis).warna, aktif: true }] : []}
          onGeser={(_, lokasi) => setF((x) => ({ ...x, lokasi }))}
          onPick={(lokasi) => setF((x) => ({ ...x, lokasi }))}
          kunci={awal?.id ?? 'baru'}
          label={tr('Peta lokasi event')}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink/60">
          <span>{f.lokasi ? `${f.lokasi.lat.toFixed(5)}, ${f.lokasi.lng.toFixed(5)}` : tr('Ketuk peta untuk menaruh penanda.')}</span>
          {f.lokasi && (
            <Tombol jenis="biasa" onClick={() => setF((x) => ({ ...x, lokasi: null }))}>
              {tr('Hapus lokasi')}
            </Tombol>
          )}
        </div>
      </div>
    </form>
  )
}
