import { Bike, Car, ChevronLeft, ChevronRight, ExternalLink, Footprints, ImageOff, Motorbike, X } from 'lucide-react'
import ErrorBanner from '../ErrorBanner.jsx'
import IkonLangkah from './IkonLangkah.jsx'
import { MODA, formatDurasi, formatJarak, tanggalFoto } from '../../lib/navigasi.js'

const IKON_MODA = { driving: Car, motorcycle: Motorbike, walking: Footprints }

const TEKS_LOKASI = {
  mencari: 'Mencari lokasimu…',
  ditolak: 'Izin lokasi ditolak. Ketuk Ganti, lalu cari alamat atau ketuk peta.',
  luar: 'Lokasimu di luar Medan. Ketuk Ganti untuk memilih titik asal.',
  tidak: 'Ketuk Ganti, lalu cari alamat atau ketuk peta.',
}

/**
 * Isi lembar bawah Smart Navigation: ajakan memilih tujuan, ringkasan rute + pilihan moda,
 * daftar langkah, panduan langkah (Play), dan foto jalan (Street view).
 */
export default function RouteSheet({
  dari,
  ke,
  lokasiStatus,
  target,
  onTarget,
  mode,
  onMode,
  rute,
  memuat,
  galat,
  onRetry,
  buka,
  onBuka,
  play,
  onPlay,
  foto,
  onTutupFoto,
}) {
  if (play !== null && rute) {
    return <Panduan rute={rute} idx={play} onPlay={onPlay} foto={foto} onTutupFoto={onTutupFoto} />
  }

  return (
    <div className="flex flex-col gap-4">
      {target === 'dari' && (
        <div className="flex items-center gap-3 rounded-2xl bg-[color:rgb(218_184_246/0.35)] py-1 pl-4 pr-1">
          <p className="flex-1 py-2 text-sm leading-snug">Pilih titik asal: cari alamat di atas atau ketuk peta.</p>
          <button
            type="button"
            onClick={() => onTarget('ke')}
            className="min-h-touch rounded-full px-3 text-sm font-semibold text-ink-violet hover:bg-ink-violet/10"
          >
            Batal
          </button>
        </div>
      )}

      {!ke ? (
        <div>
          <h2 className="font-serif text-[1.625rem] leading-tight">Mau ke mana?</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-ink/70">
            Cari tempat di kolom atas atau ketuk peta untuk memilih tujuan.
          </p>
        </div>
      ) : (
        <Ringkasan rute={rute} memuat={memuat} galat={galat} onRetry={onRetry} />
      )}

      {ke && <PilihModa mode={mode} onMode={onMode} />}

      {foto.status !== 'mati' && <FotoJalan foto={foto} onTutup={onTutupFoto} />}

      <Rencana dari={dari} ke={ke} lokasiStatus={lokasiStatus} target={target} onTarget={onTarget} />

      {rute && (
        <section aria-labelledby="langkah-judul">
          <button
            type="button"
            onClick={() => onBuka(!buka)}
            aria-expanded={buka}
            className="flex min-h-touch w-full items-center justify-between gap-2 rounded-xl text-left"
          >
            <h3 id="langkah-judul" className="text-[15px] font-bold">
              {rute.langkah.length} langkah
            </h3>
            <span className="text-sm font-semibold text-ink-violet">{buka ? 'Sembunyikan' : 'Lihat semua'}</span>
          </button>
          {buka && <DaftarLangkah langkah={rute.langkah} onPilih={(i) => onPlay(i)} />}
        </section>
      )}
    </div>
  )
}

function Ringkasan({ rute, memuat, galat, onRetry }) {
  if (galat) return <ErrorBanner error={galat} onRetry={onRetry} />
  if (memuat || !rute) {
    return (
      <div aria-busy="true" aria-label="Menghitung rute" className="animate-pulse">
        <div className="h-9 w-32 rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-44 rounded bg-ink/[0.07]" />
      </div>
    )
  }
  return (
    <div aria-live="polite">
      <p className="flex items-baseline gap-3">
        <span className="font-serif text-[2.25rem] leading-none text-ink">{formatDurasi(rute.durasiS)}</span>
        <span className="text-lg font-semibold text-ink/65">{formatJarak(rute.jarakM)}</span>
      </p>
      <p className="mt-1.5 text-sm text-ink/65">Perkiraan waktu tanpa macet.</p>
    </div>
  )
}

function PilihModa({ mode, onMode }) {
  return (
    <div role="radiogroup" aria-label="Moda" className="grid grid-cols-3 gap-1 rounded-full bg-search p-1 ring-1 ring-ink/[0.06]">
      {MODA.map((m) => {
        const Icon = IKON_MODA[m.value] ?? Bike
        const on = m.value === mode
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onMode(m.value)}
            className={`flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 text-[0.8125rem] transition lg:gap-1.5 lg:text-sm ${
              on ? 'bg-pill font-bold text-white shadow-[0_4px_12px_-4px_rgb(114_13_129/0.8)]' : 'font-medium text-ink-violet hover:bg-white'
            }`}
          >
            <Icon size={18} strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

/** Asal → tujuan, dengan garis putus-putus seperti ikon rute di mockup. */
function Rencana({ dari, ke, lokasiStatus, target, onTarget }) {
  const baris = [
    {
      key: 'dari',
      label: 'Dari',
      nama: dari?.nama,
      kosong: TEKS_LOKASI[lokasiStatus] ?? TEKS_LOKASI.tidak,
      titik: <span className="size-3.5 rounded-full border-[3px] border-ink-violet bg-white" />,
    },
    {
      key: 'ke',
      label: 'Ke',
      nama: ke?.nama,
      sub: ke?.alamat,
      kosong: 'Belum dipilih',
      titik: <span className="size-3.5 rounded-full bg-traffic-macet ring-[3px] ring-traffic-macet/25" />,
    },
  ]
  return (
    <ol className="relative">
      <span aria-hidden="true" className="absolute bottom-7 left-[6px] top-7 border-l-2 border-dotted border-ink-violet/35" />
      {baris.map((b) => (
        <li key={b.key} className="flex items-center gap-3">
          <span className="relative z-10 grid w-3.5 shrink-0 place-items-center">{b.titik}</span>
          <div className={`min-w-0 flex-1 py-2 ${target === b.key && b.key === 'dari' ? 'rounded-xl bg-[color:rgb(218_184_246/0.3)] px-2' : ''}`}>
            <p className="text-xs font-semibold text-ink/55">{b.label}</p>
            {b.nama ? (
              <>
                <p className="truncate text-[15px] font-semibold">{b.nama}</p>
                {b.sub && <p className="truncate text-xs text-ink/60">{b.sub}</p>}
              </>
            ) : (
              <p className="text-sm leading-snug text-ink/70">{b.kosong}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onTarget(target === b.key && b.key === 'dari' ? 'ke' : b.key)}
            aria-label={`Ganti titik ${b.label.toLowerCase()}`}
            className="min-h-touch shrink-0 rounded-full px-3 text-sm font-semibold text-ink-violet hover:bg-ink-violet/10"
          >
            Ganti
          </button>
        </li>
      ))}
    </ol>
  )
}

function DaftarLangkah({ langkah, onPilih }) {
  return (
    <ol className="mt-1 flex flex-col">
      {langkah.map((l, i) => {
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onPilih(i)}
              className="flex min-h-touch w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-ink/[0.04]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:rgb(218_184_246/0.45)] text-ink-violet">
                <IkonLangkah teks={l.teks} size={18} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-snug">{l.teks}</span>
              {l.jarakM > 0 && <span className="shrink-0 text-sm tabular-nums text-ink/60">{formatJarak(l.jarakM)}</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Panduan langkah (Play): satu langkah besar, maju/mundur, peta mengikuti titik belokan. */
function Panduan({ rute, idx, onPlay, foto, onTutupFoto }) {
  const total = rute.langkah.length
  const l = rute.langkah[idx]
  const terakhir = idx === total - 1
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink/60" aria-live="polite">
          Langkah {idx + 1} dari {total}
        </p>
        <button
          type="button"
          onClick={() => onPlay(null)}
          className="flex min-h-touch items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-violet hover:bg-ink-violet/10"
        >
          <X size={18} aria-hidden="true" />
          Selesai
        </button>
      </div>
      <div className="flex items-start gap-4">
        <span className="bg-pill grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-[0_8px_18px_-8px_rgb(114_13_129/0.9)]">
          <IkonLangkah teks={l.teks} size={30} strokeWidth={2.25} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-[1.5rem] leading-tight">{l.teks}</p>
          {!terakhir && l.jarakM > 0 && (
            <p className="mt-1 text-[15px] text-ink/70">Lalu ikuti jalan {formatJarak(l.jarakM)}</p>
          )}
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden="true">
        <div className="bg-pill h-full rounded-full transition-[width] duration-300" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onPlay(idx - 1)}
          disabled={idx === 0}
          className="flex min-h-touch items-center justify-center gap-1 rounded-full bg-search font-semibold text-ink-violet ring-1 ring-ink/[0.06] transition hover:bg-white disabled:opacity-40"
        >
          <ChevronLeft size={20} aria-hidden="true" />
          Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => onPlay(terakhir ? null : idx + 1)}
          className="flex min-h-touch items-center justify-center gap-1 rounded-full bg-login-button font-semibold text-white shadow-[0_6px_16px_-6px_rgb(115_36_169/0.8)] transition hover:brightness-110"
        >
          {terakhir ? 'Selesai' : 'Berikutnya'}
          {!terakhir && <ChevronRight size={20} aria-hidden="true" />}
        </button>
      </div>
      {foto.status !== 'mati' && <FotoJalan foto={foto} onTutup={onTutupFoto} />}
    </div>
  )
}

/** Foto jalan Mapillary (Keputusan #5). */
function FotoJalan({ foto, onTutup }) {
  return (
    <section aria-labelledby="foto-judul" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 id="foto-judul" className="text-[15px] font-bold">
          Street view
        </h3>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup Street view"
          className="grid size-touch place-items-center rounded-full text-ink/60 hover:bg-ink/5"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {foto.status === 'memuat' && <div className="aspect-[16/10] animate-pulse rounded-2xl bg-ink/[0.08]" aria-label="Memuat foto jalan" />}
      {foto.status === 'galat' && <ErrorBanner error={foto.error} />}
      {foto.status === 'kosong' && (
        <div className="flex items-center gap-3 rounded-2xl bg-search px-4 py-4">
          <ImageOff size={24} className="shrink-0 text-ink/50" aria-hidden="true" />
          <div>
            <p className="text-[15px] font-semibold">Belum ada foto jalan di sini</p>
            <p className="text-sm text-ink/65">Coba titik lain, mis. langkah berikutnya saat Play.</p>
          </div>
        </div>
      )}
      {foto.status === 'ada' && (
        <figure>
          <img
            src={foto.data.url}
            alt={`Foto jalan sekitar ${foto.nama || 'titik ini'}`}
            className="aspect-[16/10] w-full rounded-2xl bg-ink/[0.08] object-cover"
          />
          <figcaption className="mt-2 flex items-start justify-between gap-3 text-xs leading-snug text-ink/65">
            <span>
              ±{formatJarak(foto.data.jarakM)} dari titik, {tanggalFoto(foto.data.diambil)}
              <br />© Mapillary{foto.data.pengunggah ? `, ${foto.data.pengunggah}` : ''} (CC BY-SA)
            </span>
            <a
              href={foto.data.halaman}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-10 shrink-0 items-center gap-1 rounded-full px-2 font-semibold text-ink-violet hover:bg-ink-violet/10"
            >
              Buka
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </figcaption>
        </figure>
      )}
    </section>
  )
}
