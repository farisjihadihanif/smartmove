import { useEffect, useId, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin } from 'lucide-react'
import { api, latLng } from '../../lib/api.js'
import { errorMessage } from '../../lib/errors.js'
import { formatJarak } from '../../lib/navigasi.js'
import { MEDAN_CENTER } from '../../lib/geo.js'
import { tr } from '../../lib/i18n.js'

const JEDA_MS = 450

/**
 * Kolom tempat untuk form Trip Planner: ketik → saran dari /places/search (lewat API, AGENTS aturan #1).
 * `value`: { nama, lokasi } terpilih atau null. `lokasiSaya`: tampilkan "Pakai lokasi saat ini".
 */
export default function TempatField({ label, value, onChange, near, lokasiSaya = false, placeholder, marker }) {
  const id = useId()
  const [teks, setTeks] = useState(value?.nama ?? '')
  const [hasil, setHasil] = useState(null) // { status, items, pesan }
  const [fokus, setFokus] = useState(false)
  const kotak = useRef(null)

  // Nilai dari luar (mis. tukar asal-tujuan, ubah rencana) menimpa teks.
  const [nilaiLama, setNilaiLama] = useState(value)
  if (value !== nilaiLama) {
    setNilaiLama(value)
    setTeks(value?.nama ?? '')
  }

  const pencarian = teks.trim()
  const perluCari = fokus && pencarian.length >= 3 && pencarian !== value?.nama
  useEffect(() => {
    if (!perluCari) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setHasil({ status: 'memuat', items: [] })
      const titik = near ?? { lat: MEDAN_CENTER[0], lng: MEDAN_CENTER[1] }
      api.get('/places/search', { query: { q: pencarian, near: latLng(titik) }, signal: ctrl.signal }).then(
        ({ items }) => setHasil({ status: 'ok', items }),
        (e) => e.name !== 'AbortError' && setHasil({ status: 'galat', items: [], pesan: errorMessage(e) }),
      )
    }, JEDA_MS)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // near hanya mengarahkan urutan hasil; tidak perlu mencari ulang saat berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perluCari, pencarian])

  function pilih(t) {
    onChange({ nama: t.nama, lokasi: t.lokasi })
    setHasil(null)
    setFokus(false)
  }

  function pakaiLokasi() {
    if (!('geolocation' in navigator)) {
      return setHasil({ status: 'galat', items: [], pesan: tr('Peramban ini tidak bisa membaca lokasi. Ketik nama tempatnya.') })
    }
    setHasil({ status: 'memuat', items: [], pesan: tr('Mencari lokasimu…') })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lokasi = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        try {
          const { tempat } = await api.get('/places/reverse', { query: { at: latLng(lokasi) } })
          pilih({ nama: tempat.nama, lokasi })
        } catch (e) {
          setHasil({ status: 'galat', items: [], pesan: errorMessage(e) })
        }
      },
      () => setHasil({ status: 'galat', items: [], pesan: tr('Izin lokasi ditolak. Ketik nama tempatnya.') }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const tampil = fokus || hasil?.status === 'galat' || (hasil?.status === 'memuat' && hasil.pesan)
  const tampilSaran = tampil && (hasil || (lokasiSaya && !pencarian))

  return (
    <div
      ref={kotak}
      className="relative"
      onBlur={(e) => {
        if (!kotak.current?.contains(e.relatedTarget)) setFokus(false)
      }}
    >
      <label htmlFor={id} className="flex min-h-touch items-center gap-3 rounded-2xl bg-search px-3 ring-1 ring-ink/[0.06] focus-within:ring-2 focus-within:ring-ink-violet">
        <span className="w-9 shrink-0 text-[13px] font-semibold text-ink/60">{label}</span>
        <input
          id={id}
          value={teks}
          onChange={(e) => {
            setTeks(e.target.value)
            if (value) onChange(null)
            if (e.target.value.trim().length < 3) setHasil(null)
          }}
          onFocus={() => setFokus(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink/50"
        />
        {marker}
      </label>

      {tampilSaran && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl bg-surface p-1.5 shadow-[0_18px_40px_-14px_rgb(65_57_111/0.6)] ring-1 ring-ink/[0.06]">
          {lokasiSaya && !pencarian && !hasil && (
            <button
              type="button"
              onClick={pakaiLokasi}
              className="flex min-h-touch w-full items-center gap-3 rounded-xl px-2 text-left text-[15px] font-semibold text-ink-violet hover:bg-ink/[0.04]"
            >
              <Crosshair size={18} aria-hidden="true" />
              {tr('Pakai lokasi saat ini')}
            </button>
          )}
          {hasil?.status === 'memuat' && (
            <p className="flex items-center gap-2 px-2 py-3 text-sm text-ink/70">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              {hasil.pesan ?? tr('Mencari tempat…')}
            </p>
          )}
          {hasil?.status === 'galat' && <p role="alert" className="px-2 py-3 text-sm text-[#C62828]">{hasil.pesan}</p>}
          {hasil?.status === 'ok' && hasil.items.length === 0 && (
            <p className="px-2 py-3 text-sm text-ink/70">{tr('Tidak ditemukan di Medan dan sekitarnya. Coba nama lain.')}</p>
          )}
          {hasil?.status === 'ok' &&
            hasil.items.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pilih(t)}
                className="flex min-h-touch w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-ink/[0.04]"
              >
                <MapPin size={18} className="shrink-0 text-ink-violet" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{t.nama}</span>
                  {t.alamat && <span className="block truncate text-xs text-ink/60">{t.alamat}</span>}
                </span>
                {t.jarakM !== undefined && <span className="shrink-0 text-xs tabular-nums text-ink/55">{formatJarak(t.jarakM)}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
