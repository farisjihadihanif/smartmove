import { useEffect, useState } from 'react'
import { ArrowUpDown, Loader2 } from 'lucide-react'
import ErrorBanner from '../ErrorBanner.jsx'
import TempatField from './TempatField.jsx'
import { IKON_MODA } from './ikonModa.js'
import { api, latLng } from '../../lib/api.js'
import { MODA_TRIP, dariIsian, keIsian, teksRingkasan } from '../../lib/trip.js'
import { ringkasanTrip } from '../../lib/transit.js'

/**
 * Form rencana perjalanan: asal & tujuan bertumpuk (seperti rute), moda, jam berangkat (WIB, opsional), nama.
 * Estimasi waktu & jarak dihitung dari /routes (transit: opsi tercepat /routes/transit, + tarif) dan ikut disimpan sebagai `ringkasan`.
 * `awal`: rencana yang diubah, atau null untuk rencana baru.
 */
export default function TripForm({ awal, onSimpan, onBatal, idJudul }) {
  const [asal, setAsal] = useState(awal?.asal ?? null)
  const [tujuan, setTujuan] = useState(awal?.tujuan ?? null)
  const [moda, setModa] = useState(awal?.moda ?? 'driving')
  const [waktu, setWaktu] = useState(() => keIsian(awal?.berangkatPada))
  const [judul, setJudul] = useState(awal?.judul ?? '')
  const [estimasi, setEstimasi] = useState({ kunci: null, data: null })
  const [kirim, setKirim] = useState({ status: 'diam', error: null })

  const kunci = asal && tujuan ? `${latLng(asal.lokasi)};${latLng(tujuan.lokasi)};${moda}` : null
  useEffect(() => {
    if (!kunci) return
    const ctrl = new AbortController()
    const from = latLng(asal.lokasi)
    const to = latLng(tujuan.lokasi)
    const minta =
      moda === 'transit'
        ? api.get('/routes/transit', { query: { from, to }, signal: ctrl.signal }).then((r) => (r.opsi[0] ? ringkasanTrip(r.opsi[0]) : null))
        : api.get('/routes', { query: { from, to, mode: moda }, signal: ctrl.signal }).then((r) => ({ jarakM: r.jarakM, durasiS: r.durasiS }))
    minta
      .then(
        (data) => setEstimasi({ kunci, data }),
        (e) => e.name !== 'AbortError' && setEstimasi({ kunci, data: null }),
      )
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci])
  const kunciAwal = awal ? `${latLng(awal.asal.lokasi)};${latLng(awal.tujuan.lokasi)};${awal.moda}` : null
  const ringkasan = kunci && estimasi.kunci === kunci ? estimasi.data : null
  const memuatEstimasi = Boolean(kunci) && estimasi.kunci !== kunci

  async function simpan(e) {
    e.preventDefault()
    if (!asal || !tujuan) {
      return setKirim({ status: 'galat', error: { message: !asal ? 'Pilih titik asal dari daftar saran.' : 'Pilih tujuan dari daftar saran.' } })
    }
    setKirim({ status: 'kirim', error: null })
    try {
      await onSimpan({
        judul: judul.trim() || null,
        asal,
        tujuan,
        moda,
        berangkatPada: dariIsian(waktu),
        ringkasan: ringkasan ?? (kunci && kunci === kunciAwal ? awal.ringkasan : null),
      })
    } catch (error) {
      setKirim({ status: 'galat', error })
    }
  }

  const teksEstimasi = memuatEstimasi ? null : teksRingkasan(ringkasan, moda)
  const tanpaRuteUmum = moda === 'transit' && Boolean(kunci) && estimasi.kunci === kunci && !estimasi.data

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-5" aria-labelledby={idJudul}>
      <fieldset className="relative">
        <legend className="sr-only">Rute</legend>
        <div className="flex flex-col gap-2 pr-12">
          <TempatField
            label="Dari"
            value={asal}
            onChange={setAsal}
            lokasiSaya
            placeholder="Cari titik asal"
            near={tujuan?.lokasi}
          />
          <TempatField label="Ke" value={tujuan} onChange={setTujuan} placeholder="Cari tujuan" near={asal?.lokasi} />
        </div>
        <button
          type="button"
          onClick={() => {
            setAsal(tujuan)
            setTujuan(asal)
          }}
          aria-label="Tukar asal dan tujuan"
          className="absolute right-0 top-1/2 grid size-touch -translate-y-1/2 place-items-center rounded-full text-ink-violet ring-1 ring-ink-violet/20 transition hover:bg-ink-violet/[0.06]"
        >
          <ArrowUpDown size={20} aria-hidden="true" />
        </button>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink/75">Naik apa?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {MODA_TRIP.map((m) => {
            const Ikon = IKON_MODA[m.value]
            const aktif = moda === m.value
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={aktif}
                onClick={() => setModa(m.value)}
                className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 text-[13px] leading-tight transition ${
                  aktif
                    ? 'bg-pill font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]'
                    : 'bg-white text-ink-violet ring-1 ring-ink-violet/20 hover:bg-ink-violet/[0.05]'
                }`}
              >
                <Ikon size={20} aria-hidden="true" />
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink/75">Berangkat (WIB)</legend>
        <div className="flex gap-2">
          <label className="flex min-h-touch flex-[3] items-center rounded-2xl bg-search px-3 ring-1 ring-ink/[0.06] focus-within:ring-2 focus-within:ring-ink-violet">
            <span className="sr-only">Tanggal berangkat</span>
            <input
              type="date"
              value={waktu.tanggal}
              onChange={(e) => setWaktu((w) => ({ ...w, tanggal: e.target.value }))}
              className="h-12 w-full min-w-0 bg-transparent text-[15px] outline-none"
            />
          </label>
          <label className="flex min-h-touch flex-[2] items-center rounded-2xl bg-search px-3 ring-1 ring-ink/[0.06] focus-within:ring-2 focus-within:ring-ink-violet">
            <span className="sr-only">Jam berangkat</span>
            <input
              type="time"
              value={waktu.jam}
              onChange={(e) => setWaktu((w) => ({ ...w, jam: e.target.value }))}
              className="h-12 w-full min-w-0 bg-transparent text-[15px] outline-none"
            />
          </label>
        </div>
        <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink/60">
          <span>{waktu.jam ? (waktu.tanggal ? 'Terjadwal' : 'Tanpa tanggal = hari ini') : 'Kosongkan jam bila belum tahu kapan berangkat.'}</span>
          {(waktu.jam || waktu.tanggal) && (
            <button type="button" onClick={() => setWaktu({ tanggal: '', jam: '' })} className="min-h-8 font-semibold text-ink-violet">
              Kosongkan
            </button>
          )}
        </p>
      </fieldset>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-ink/75">Nama rencana (opsional)</span>
        <input
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          maxLength={100}
          placeholder="mis. Berangkat kuliah"
          className="h-12 w-full rounded-2xl bg-search px-4 text-[15px] outline-none ring-1 ring-ink/[0.06] placeholder:text-ink/50 focus:ring-2 focus:ring-ink-violet"
        />
      </label>

      {(memuatEstimasi || teksEstimasi) && (
        <p className="flex items-center gap-2 text-sm text-ink/75" aria-live="polite">
          {memuatEstimasi ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Menghitung estimasi…
            </>
          ) : (
            <>
              Estimasi <strong className="font-semibold text-ink">{teksEstimasi}</strong>
            </>
          )}
        </p>
      )}

      {tanpaRuteUmum && (
        <p className="text-sm leading-snug text-ink/70" aria-live="polite">
          Belum ada angkot atau bus yang lewat dekat titik asal dan tujuan. Rencana tetap bisa disimpan.
        </p>
      )}

      {kirim.status === 'galat' && <ErrorBanner error={kirim.error} message={kirim.error?.status ? undefined : kirim.error?.message} />}

      <div className="flex gap-2">
        {onBatal && (
          <button
            type="button"
            onClick={onBatal}
            className="min-h-touch flex-1 rounded-full px-5 text-[15px] font-semibold text-ink-violet ring-1 ring-ink-violet/25 hover:bg-ink-violet/[0.05]"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={kirim.status === 'kirim'}
          className="flex min-h-touch flex-[2] items-center justify-center gap-2 rounded-full bg-login-button px-5 text-[15px] font-semibold text-white shadow-[0_6px_18px_-6px_rgb(115_36_169/0.7)] transition hover:brightness-110 disabled:opacity-70"
        >
          {kirim.status === 'kirim' && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          {awal ? 'Simpan perubahan' : 'Simpan rencana'}
        </button>
      </div>
    </form>
  )
}
