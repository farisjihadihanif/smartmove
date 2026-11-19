import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PillToggle from '../../components/PillToggle.jsx'
import { Chip, Field, Halaman, Judul, Tombol, TombolHapus, kelasInput } from '../../components/admin/ui.jsx'
import { api } from '../../lib/api.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { dariInputWib, keInputWib, jamAtauTanggal } from '../../lib/wib.js'

// Kelola voucher Rewards (PRD §6.4, T-304): nama, poin, stok, masa berlaku, syarat.
export default function Voucher() {
  const [aktif, setAktif] = useState('semua')
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState(null) // null | 'baru' | voucher
  const [galat, setGalat] = useState(null)
  const { data, error, muatUlang } = useApiGet('/admin/vouchers', aktif === 'semua' ? { page } : { page, aktif })
  const [now] = useState(() => Date.now())

  return (
    <>
      <Judul aksi={!edit && <Tombol onClick={() => setEdit('baru')}>Tambah voucher</Tombol>}>Voucher</Judul>
      {edit ? (
        <FormVoucher
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
              { value: 'semua', label: 'Semua' },
              { value: 'true', label: 'Aktif' },
              { value: 'false', label: 'Nonaktif' },
            ]}
            value={aktif}
            onChange={(v) => {
              setAktif(v)
              setPage(1)
            }}
            label="Saring voucher"
            fitDesktop
            className="mb-4"
          />
          {(error || galat) && <ErrorBanner error={error || galat} onRetry={error ? muatUlang : undefined} className="mb-4" />}
          <ul className="divide-y divide-ink/[0.06]">
            {data?.items.map((v) => {
              const lewat = v.berlakuSampai && new Date(v.berlakuSampai).getTime() < now
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-20 shrink-0 font-serif text-[1.25rem] leading-none text-ink-violet tabular-nums">
                    {v.poin.toLocaleString('id-ID')}
                    <span className="block font-sans text-[11px] font-semibold text-ink/50">poin</span>
                  </span>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold">{v.nama}</p>
                    <p className="text-xs text-ink/60">
                      Stok {v.stok}, ditukar {v.ditukar}
                      {v.berlakuSampai ? `, berlaku sampai ${jamAtauTanggal(v.berlakuSampai, now)}` : ', tanpa batas waktu'}
                    </p>
                  </div>
                  {!v.aktif && <Chip>Nonaktif</Chip>}
                  {lewat && <Chip nada="kuning">Lewat masa berlaku</Chip>}
                  {v.aktif && v.stok === 0 && <Chip nada="merah">Stok habis</Chip>}
                  <Tombol jenis="biasa" onClick={() => setEdit(v)}>
                    Ubah
                  </Tombol>
                  {v.ditukar === 0 && (
                    <TombolHapus
                      onHapus={async () => {
                        setGalat(null)
                        try {
                          await api.del(`/admin/vouchers/${v.id}`)
                          muatUlang()
                        } catch (e) {
                          setGalat(e)
                        }
                      }}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          {data && data.items.length === 0 && <p className="mt-4 text-sm text-ink/60">Belum ada voucher. Tambahkan supaya poin pengguna bisa ditukar.</p>}
          {data && <Halaman page={data.page} total={data.total} limit={50} onPage={setPage} />}
          <p className="mt-6 text-xs text-ink/55">Voucher yang sudah pernah ditukar tidak bisa dihapus; nonaktifkan supaya tidak tampil di katalog.</p>
        </>
      )}
    </>
  )
}

function FormVoucher({ awal, onSelesai }) {
  const [f, setF] = useState({
    nama: awal?.nama ?? '',
    deskripsi: awal?.deskripsi ?? '',
    syarat: awal?.syarat ?? '',
    poin: awal?.poin ?? 100,
    stok: awal?.stok ?? 10,
    berlakuSampai: keInputWib(awal?.berlakuSampai),
    aktif: awal?.aktif ?? true,
  })
  const [kirim, setKirim] = useState({ jalan: false, error: null })
  const ubah = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function simpan(e) {
    e.preventDefault()
    setKirim({ jalan: true, error: null })
    const body = {
      nama: f.nama,
      deskripsi: f.deskripsi,
      syarat: f.syarat,
      poin: Number(f.poin),
      stok: Number(f.stok),
      berlakuSampai: dariInputWib(f.berlakuSampai),
      aktif: f.aktif,
    }
    try {
      if (awal) await api.patch(`/admin/vouchers/${awal.id}`, body)
      else await api.post('/admin/vouchers', body)
      onSelesai()
    } catch (error) {
      setKirim({ jalan: false, error })
    }
  }

  return (
    <form onSubmit={simpan} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <Field label="Nama voucher" className="sm:col-span-2">
        <input value={f.nama} onChange={ubah('nama')} required maxLength={120} className={kelasInput} placeholder="Gratis 1 jam parkir" />
      </Field>
      <Field label="Harga (poin)">
        <input type="number" min={1} step={1} value={f.poin} onChange={ubah('poin')} required className={kelasInput} />
      </Field>
      <Field label="Stok" hint={awal ? `Sudah ditukar ${awal.ditukar} kali.` : undefined}>
        <input type="number" min={0} step={1} value={f.stok} onChange={ubah('stok')} required className={kelasInput} />
      </Field>
      <Field label="Berlaku sampai (WIB)" hint="Kosongkan bila tanpa batas waktu.">
        <input type="datetime-local" value={f.berlakuSampai} onChange={ubah('berlakuSampai')} className={kelasInput} />
      </Field>
      <label className="flex min-h-touch items-center gap-3 self-end text-sm font-semibold">
        <input type="checkbox" checked={f.aktif} onChange={ubah('aktif')} className="size-5 accent-[color:var(--color-pill-via)]" />
        Tampil di katalog
      </label>
      <Field label="Deskripsi (opsional)" className="sm:col-span-2">
        <textarea value={f.deskripsi} onChange={ubah('deskripsi')} maxLength={500} rows={2} className={`${kelasInput} py-2.5`} />
      </Field>
      <Field label="Syarat & ketentuan (opsional)" className="sm:col-span-2">
        <textarea value={f.syarat} onChange={ubah('syarat')} maxLength={1000} rows={3} className={`${kelasInput} py-2.5`} />
      </Field>
      {kirim.error && <ErrorBanner error={kirim.error} className="sm:col-span-2" />}
      <div className="flex gap-3 sm:col-span-2">
        <Tombol type="submit" memuat={kirim.jalan}>
          {awal ? 'Simpan perubahan' : 'Tambah voucher'}
        </Tombol>
        <Tombol jenis="biasa" onClick={onSelesai}>
          Batal
        </Tombol>
      </div>
    </form>
  )
}
