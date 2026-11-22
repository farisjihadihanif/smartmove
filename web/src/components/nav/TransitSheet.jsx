import { Bus, ChevronLeft, ChevronRight, Footprints, TrainFront, X } from 'lucide-react'
import ErrorBanner from '../ErrorBanner.jsx'
import { formatDurasi, formatJarak } from '../../lib/navigasi.js'
import {
  LABEL_JENIS,
  WARNA_JALAN,
  indeksNaik,
  judulNaik,
  namaKoridor,
  ringkasOpsi,
  teksBagian,
  teksJalan,
  teksNaik,
  tarifPerkiraan,
  teksTarif,
  teksTarifRingkas,
  teksTurun,
  warnaNaik,
} from '../../lib/transit.js'
import { tr } from '../../lib/i18n.js'

// Rute transportasi umum (T-203): ringkasan, pilihan opsi, dan garis perjalanan per bagian.
// Warna rel di sini = warna garis di peta (NavLayers), jadi pengguna bisa mencocokkan keduanya.

/** Penanda tarif yang bukan isian admin (tarif bawaan per jenis angkutan atau dari OSM). */
const LabelPerkiraan = () => (
  <span
    className="inline-flex items-center whitespace-nowrap rounded-full border border-ink/20 px-2 py-0.5 text-xs font-semibold text-ink/65"
    title={tr('Tarif bawaan sesuai jenis angkutan, belum dikonfirmasi admin')}
  >
    {tr('Tarif perkiraan')}
  </span>
)

const IKON_JENIS = { kereta: TrainFront }
const IkonJenis = ({ jenis, ...p }) => {
  const I = IKON_JENIS[jenis] ?? Bus
  return <I {...p} />
}

export function TransitRingkasan({ data, memuat, galat, onRetry, idx, onIdx }) {
  if (galat) return <ErrorBanner error={galat} onRetry={onRetry} />
  if (memuat || !data) {
    return (
      <div aria-busy="true" aria-label={tr('Mencari rute transportasi umum')} className="animate-pulse">
        <div className="h-9 w-32 rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-56 rounded bg-ink/[0.07]" />
        <div className="mt-5 h-24 rounded-2xl bg-ink/[0.05]" />
      </div>
    )
  }
  if (!data.opsi.length) {
    return (
      <div>
        <h2 className="font-serif text-[1.5rem] leading-tight">{tr('Belum ada angkot atau bus di rute ini')}</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink/70">
          {tr('Tidak ada trayek yang lewat dalam jarak jalan kaki dari titik asal dan tujuan. Geser titiknya ke jalan besar terdekat, atau pilih Mobil, Motor, atau Jalan kaki.')}
        </p>
      </div>
    )
  }
  const opsi = data.opsi[idx] ?? data.opsi[0]
  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-serif text-[2.25rem] leading-none">{formatDurasi(opsi.totalS)}</span>
          <span className={`text-[15px] font-semibold ${opsi.tarif === null ? 'text-ink/55' : 'text-ink/75'}`}>
            {opsi.tarif === null ? tr('Tarif belum tersedia') : teksTarif(opsi.tarif)}
          </span>
          {tarifPerkiraan(opsi) && <LabelPerkiraan />}
        </p>
        <p className="mt-1.5 text-sm text-ink/65">
          {opsi.transfer ? tr("{0}× pindah", { 0: opsi.transfer }) : tr('Tanpa pindah')}{tr(', jalan kaki')} {formatJarak(opsi.jalanM)}
          {opsi.perkiraan ? tr('. Jarak jalan kaki masih perkiraan.') : '.'}
        </p>
      </div>
      {data.opsi.length > 1 && <PilihOpsi opsi={data.opsi} idx={idx} onIdx={onIdx} />}
      <GarisPerjalanan bagian={opsi.bagian} />
    </div>
  )
}

/** Opsi lain sebagai rantai kecil: jalan · [KPUM 69] · jalan, plus durasinya. */
function PilihOpsi({ opsi, idx, onIdx }) {
  return (
    <div role="radiogroup" aria-label={tr('Pilihan rute')} className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:-mx-1 lg:flex-wrap lg:px-1">
      {opsi.map((o, i) => {
        const on = i === idx
        const urut = indeksNaik(o.bagian)
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${formatDurasi(o.totalS)}, ${o.bagian.filter((b) => b.jenis === 'naik').map(judulNaik).join(tr(', lalu '))}. ${ringkasOpsi(o)}`}
            onClick={() => onIdx(i)}
            className={`flex min-h-touch shrink-0 snap-start items-center gap-2 rounded-2xl px-3 py-2 text-left transition ${
              on ? 'bg-card ring-2 ring-pill-via shadow-[0_6px_16px_-10px_rgb(114_13_129/0.9)]' : 'bg-search ring-1 ring-ink/[0.06] hover:bg-card'
            }`}
          >
            <span className={`text-[15px] tabular-nums ${on ? 'font-bold' : 'font-semibold text-ink/75'}`}>{formatDurasi(o.totalS)}</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              {o.bagian.map((b, j) =>
                b.jenis === 'jalan' ? (
                  <Footprints key={j} size={14} className="text-ink/45" />
                ) : (
                  <span
                    key={j}
                    className="whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: warnaNaik(urut[j]) }}
                  >
                    {namaKoridor(b.koridor).nama}
                  </span>
                ),
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Rel vertikal: jalan kaki titik-titik, kendaraan batang tebal berwarna sama dengan garis di peta. */
function GarisPerjalanan({ bagian }) {
  const urut = indeksNaik(bagian)
  return (
    <ol aria-label={tr('Langkah perjalanan')} className="flex flex-col">
      {bagian.map((b, i) =>
        b.jenis === 'jalan' ? (
          <BarisJalan key={i} b={b} terakhir={i === bagian.length - 1} />
        ) : (
          <BarisNaik key={i} b={b} warna={warnaNaik(urut[i])} />
        ),
      )}
    </ol>
  )
}

function BarisJalan({ b, terakhir }) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3">
      <span aria-hidden="true" className="relative flex justify-center">
        <span className="absolute inset-y-0 border-l-[3px] border-dotted" style={{ borderColor: `${WARNA_JALAN}66` }} />
        <span className="relative mt-2 grid size-8 place-items-center rounded-full bg-search text-ink-violet ring-4 ring-surface">
          <Footprints size={16} strokeWidth={2.25} />
        </span>
      </span>
      <div className="py-2.5">
        <p className="text-[15px] font-semibold leading-snug">{teksJalan(b, terakhir)}</p>
        <p className="mt-0.5 text-sm text-ink/60">
          {formatDurasi(b.durasiS)}
          {b.perkiraan ? tr(', perkiraan') : ''}
        </p>
      </div>
    </li>
  )
}

function BarisNaik({ b, warna }) {
  const { nama, trayek } = namaKoridor(b.koridor)
  const lain = (b.koridorLain ?? []).map((k) => namaKoridor(k).nama)
  const meta = [formatJarak(b.jarakM), formatDurasi(b.durasiS)]
  if (b.jumlahHalte) meta.push(`${b.jumlahHalte} halte`)
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3">
      <span aria-hidden="true" className="relative flex justify-center">
        <span className="absolute bottom-4 top-4 w-1.5 rounded-full" style={{ backgroundColor: warna }} />
        <span className="relative mt-3 size-4 rounded-full border-[3.5px] bg-card" style={{ borderColor: warna }} />
        <span className="absolute bottom-3 size-4 rounded-full border-[3.5px] bg-card" style={{ borderColor: warna }} />
      </span>
      <div className="flex flex-col gap-2.5 py-2">
        <p className="text-[15px] font-semibold leading-snug">{teksNaik(b)}</p>
        <div className="rounded-2xl px-3.5 py-3" style={{ backgroundColor: `${warna}12` }}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: warna }}
            >
              <IkonJenis jenis={b.koridor.jenis} size={13} strokeWidth={2.5} aria-hidden="true" />
              {LABEL_JENIS[b.koridor.jenis] ?? tr('Kendaraan')}
            </span>
            <span className="text-[17px] font-bold leading-tight">{nama}</span>
          </p>
          {trayek && <p className="mt-1 text-sm leading-snug text-ink/70">{trayek}</p>}
          <p className="mt-1.5 text-sm text-ink/65">
            {meta.join(', ')},{' '}
            <span className={b.tarif === null ? 'italic text-ink/55' : 'font-semibold text-ink/80'}>{teksTarif(b.tarif)}</span>
            {tarifPerkiraan(b) && (
              <>
                {' '}
                <LabelPerkiraan />
              </>
            )}
          </p>
          {lain.length > 0 && (
            <p className="mt-1.5 text-sm leading-snug text-ink/65">
              {tr('Juga lewat sini:')} <span className="font-semibold text-ink/80">{lain.join(', ')}</span>
            </p>
          )}
        </div>
        <p className="pb-1 text-[15px] font-semibold leading-snug">{teksTurun(b)}</p>
      </div>
    </li>
  )
}

/** Panduan per bagian (Play): satu bagian besar, maju/mundur, peta mengikuti titik awal bagian. */
export function TransitPanduan({ opsi, idx, onPlay, children }) {
  const total = opsi.bagian.length
  const b = opsi.bagian[idx]
  const urut = indeksNaik(opsi.bagian)
  const terakhir = idx === total - 1
  const warna = b.jenis === 'naik' ? warnaNaik(urut[idx]) : WARNA_JALAN
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink/60" aria-live="polite">
          {tr('Bagian')} {idx + 1} {tr('dari')} {total}
        </p>
        <button
          type="button"
          onClick={() => onPlay(null)}
          className="flex min-h-touch items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-violet hover:bg-ink-violet/10"
        >
          <X size={18} aria-hidden="true" />
          {tr('Selesai')}
        </button>
      </div>
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-[0_8px_18px_-8px_rgb(65_57_111/0.9)]" style={{ backgroundColor: warna }}>
          {b.jenis === 'jalan' ? (
            <Footprints size={28} strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <IkonJenis jenis={b.koridor.jenis} size={28} strokeWidth={2.25} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          {b.jenis === 'jalan' ? (
            <>
              <p className="font-serif text-[1.5rem] leading-tight">{teksBagian(b, idx, opsi.bagian)}</p>
              <p className="mt-1 text-[15px] text-ink/70">{tr('Sekitar')} {formatDurasi(b.durasiS)}</p>
            </>
          ) : (
            <>
              <p className="font-serif text-[1.5rem] leading-tight">{judulNaik(b)}</p>
              <p className="mt-1 text-[15px] leading-snug text-ink/75">{teksNaik(b)}</p>
              <p className="mt-0.5 text-[15px] leading-snug text-ink/75">{teksTurun(b)}</p>
              <p className="mt-1 text-sm text-ink/60">
                {formatDurasi(b.durasiS)}, <span className={b.tarif === null ? 'italic' : ''}>{teksTarifRingkas(b)}</span>
              </p>
            </>
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
          className="flex min-h-touch items-center justify-center gap-1 rounded-full bg-search font-semibold text-ink-violet ring-1 ring-ink/[0.06] transition hover:bg-card disabled:opacity-40"
        >
          <ChevronLeft size={20} aria-hidden="true" />
          {tr('Sebelumnya')}
        </button>
        <button
          type="button"
          onClick={() => onPlay(terakhir ? null : idx + 1)}
          className="flex min-h-touch items-center justify-center gap-1 rounded-full bg-login-button font-semibold text-white shadow-[0_6px_16px_-6px_rgb(115_36_169/0.8)] transition hover:brightness-110"
        >
          {terakhir ? tr('Selesai') : tr('Berikutnya')}
          {!terakhir && <ChevronRight size={20} aria-hidden="true" />}
        </button>
      </div>
      {children}
    </div>
  )
}
