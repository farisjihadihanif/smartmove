import { useState } from 'react'
import { Loader2, LocateFixed, Send, X } from 'lucide-react'
import ErrorBanner from '../ErrorBanner.jsx'
import { formatKm, formatMenit, infoTingkat, KEJADIAN, teksTunda, TINGKAT } from '../../lib/lalulintas.js'
import { jamWib, sejak } from '../../lib/wib.js'

// Isi panel Live Traffic Information (lembar bawah di ponsel, panel kiri di desktop).

/** Tab Estimasi Waktu: daftar koridor jalan utama, waktu tempuh sekarang vs normal. */
export function DaftarKoridor({ state, pilih, onPilih, onRetry }) {
  if (state.status === 'memuat' && !state.items.length) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-ink/70">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        Menghitung waktu tempuh jalan utama…
      </p>
    )
  }
  if (state.status === 'galat' && !state.items.length) return <ErrorBanner error={state.error} onRetry={onRetry} className="my-2" />
  if (!state.items.length) {
    return <p className="py-6 text-sm leading-relaxed text-ink/70">Data jalan utama belum tersedia. Coba lagi nanti.</p>
  }

  return (
    <>
      <ul aria-label="Estimasi waktu jalan utama" className="-mx-2">
        {state.items.map((k) => {
          const t = infoTingkat(k.tingkat)
          const tunda = teksTunda(k)
          const aktif = pilih === k.kode
          return (
            <li key={k.kode}>
              <button
                type="button"
                aria-pressed={aktif}
                onClick={() => onPilih(aktif ? null : k.kode)}
                className={`flex min-h-touch w-full items-stretch gap-3 rounded-2xl px-2 py-3 text-left transition ${
                  aktif ? 'bg-[color:rgb(218_184_246/0.35)]' : 'hover:bg-ink/[0.035]'
                }`}
              >
                <span aria-hidden="true" className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.warna }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{k.nama}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink/65">
                    <span className="font-semibold" style={{ color: k.tingkat === 'padat' ? '#B26A00' : k.tingkat ? t.warna : undefined }}>
                      {t.label}
                    </span>
                    {tunda && <span className="tabular-nums">{tunda}</span>}
                    <span className="tabular-nums">{formatKm(k.jarakM)}</span>
                  </span>
                  {k.kejadian.length > 0 && (
                    <span className="mt-1 block text-[13px] font-semibold text-[#C62828]">
                      {k.kejadian.map((x) => KEJADIAN[x] ?? x).join(', ')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  {k.tersedia ? (
                    <>
                      <span className="block font-serif text-[1.375rem] leading-tight tabular-nums">{formatMenit(k.durasiS)}</span>
                      {tunda && <span className="block text-xs text-ink/55">biasanya {formatMenit(k.durasiNormalS)}</span>}
                    </>
                  ) : (
                    <span className="block pt-1 text-xs text-ink/55">Belum bisa dihitung</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {state.diperbaruiPada && (
        <p className="mt-3 text-xs leading-relaxed text-ink/55">
          Diperbarui {jamWib(state.diperbaruiPada)} WIB. Waktu dihitung dari laporan warga dan waktu tempuh normal.
        </p>
      )}
    </>
  )
}

/** Detail satu laporan warga (ketuk penanda di Peta Interaktif). */
export function DetailLaporan({ laporan, now, onTutup, onKonfirmasi, mengirim }) {
  const t = TINGKAT[laporan.tingkat]
  return (
    <div className="rounded-3xl bg-surface p-4 ring-1 ring-ink/[0.08]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-1 size-3.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: t?.warna }} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">
            {t?.label}
            {laporan.kejadian !== 'none' && <span className="text-[#C62828]">, {KEJADIAN[laporan.kejadian].toLowerCase()}</span>}
          </p>
          <p className="mt-0.5 text-[13px] text-ink/60">
            Dilaporkan {sejak(laporan.createdAt, now).toLowerCase()}
            {laporan.konfirmasi > 0 && `, dikonfirmasi ${laporan.konfirmasi} warga`}. Hilang otomatis pukul {jamWib(laporan.expiresAt)}.
          </p>
          {laporan.catatan && <p className="mt-2 text-[15px] leading-snug">“{laporan.catatan}”</p>}
        </div>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup detail laporan"
          className="-mr-2 -mt-2 grid size-touch shrink-0 place-items-center rounded-full text-ink/60 hover:bg-black/5"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={onKonfirmasi}
        disabled={mengirim}
        className="mt-3 flex min-h-touch w-full items-center justify-center gap-2 rounded-full bg-action-pill text-[15px] font-semibold text-ink-violet transition hover:brightness-95 disabled:opacity-60"
      >
        {mengirim && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        Masih begini di sini
      </button>
    </div>
  )
}

const PILIH_TINGKAT = ['lancar', 'padat', 'macet']
const PILIH_KEJADIAN = ['none', 'kecelakaan', 'banjir', 'penutupan', 'perbaikan_jalan']

/**
 * Form Laporkan. Titik = `titik` (lokasi kamu / tengah peta), dipindah dengan mengetuk peta.
 * `onKirim({ tingkat, kejadian, catatan })` mengembalikan Promise.
 */
export function FormLaporan({ titik, namaTitik, onLokasiSaya, onBatal, onKirim }) {
  const [tingkat, setTingkat] = useState(null)
  const [kejadian, setKejadian] = useState('none')
  const [catatan, setCatatan] = useState('')
  const [status, setStatus] = useState({ kirim: false, error: null })

  async function kirim(e) {
    e.preventDefault()
    if (!tingkat || !titik) return
    setStatus({ kirim: true, error: null })
    try {
      await onKirim({ tingkat, kejadian, catatan: catatan.trim() })
    } catch (error) {
      setStatus({ kirim: false, error })
    }
  }

  return (
    <form onSubmit={kirim} aria-label="Laporkan kondisi jalan" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.375rem] leading-tight">Laporkan kondisi jalan</h2>
          <p className="mt-1 text-[13px] leading-snug text-ink/65">Ketuk peta untuk memindahkan titik. Laporan hilang sendiri setelah 2 jam.</p>
        </div>
        <button
          type="button"
          onClick={onBatal}
          aria-label="Batal melapor"
          className="-mr-2 grid size-touch shrink-0 place-items-center rounded-full text-ink/60 hover:bg-black/5"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-search px-3 py-2.5">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-pill-via ring-2 ring-white" />
        <p className="min-w-0 flex-1 truncate text-[15px]">{titik ? namaTitik || 'Titik di peta' : 'Ketuk peta untuk memilih titik'}</p>
        {onLokasiSaya && (
          <button
            type="button"
            onClick={onLokasiSaya}
            className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-ink-violet hover:bg-ink-violet/10"
          >
            <LocateFixed size={17} aria-hidden="true" />
            Lokasiku
          </button>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Seberapa ramai?</legend>
        <div className="grid grid-cols-3 gap-2">
          {PILIH_TINGKAT.map((v) => {
            const on = tingkat === v
            const w = TINGKAT[v].warna
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => setTingkat(v)}
                className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 text-[15px] font-semibold transition"
                style={{ borderColor: on ? w : 'rgb(0 0 0 / 0.08)', backgroundColor: on ? `${w}1F` : '#fff' }}
              >
                <span aria-hidden="true" className="h-1.5 w-7 rounded-full" style={{ backgroundColor: w }} />
                {TINGKAT[v].label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Ada kejadian?</legend>
        <div className="flex flex-wrap gap-2">
          {PILIH_KEJADIAN.map((v) => {
            const on = kejadian === v
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => setKejadian(v)}
                className={`min-h-touch rounded-full px-4 text-sm font-semibold transition ${
                  on ? 'bg-ink-violet text-white' : 'bg-card text-ink/80 ring-1 ring-ink/15 hover:bg-ink/[0.04]'
                }`}
              >
                {KEJADIAN[v]}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Catatan (boleh kosong)</span>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value.slice(0, 200))}
          rows={2}
          placeholder="Mis. lajur kiri tergenang"
          className="w-full resize-none rounded-2xl bg-search px-4 py-3 text-[15px] outline-none ring-1 ring-transparent focus:ring-pill-via"
        />
        <span className="mt-1 block text-right text-xs tabular-nums text-ink/50">{catatan.length}/200</span>
      </label>

      {status.error && <ErrorBanner error={status.error} />}

      <button
        type="submit"
        disabled={!tingkat || !titik || status.kirim}
        className="flex min-h-touch items-center justify-center gap-2 rounded-full bg-login-button text-base font-semibold text-white shadow-[0_6px_18px_-6px_rgb(115_36_169/0.7)] transition hover:brightness-110 disabled:opacity-50"
      >
        {status.kirim ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        Kirim laporan
      </button>
    </form>
  )
}
