import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Smartphone } from 'lucide-react'
import KodeQR from './KodeQR.jsx'
import { SIMULATOR_MIDTRANS, namaMetode, rupiah, sisaWaktu, waktuLengkap } from '../../lib/pembayaran.js'
import { tr } from '../../lib/i18n.js'

function useSekarang(aktif) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!aktif) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [aktif])
  return now
}

function TombolSalin({ teks, label }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks)
          setOk(true)
          setTimeout(() => setOk(false), 2000)
        } catch {
          setOk(false)
        }
      }}
      aria-label={tr('Salin {0}', { 0: label })}
      className="inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-violet ring-1 ring-ink-violet/25 hover:bg-ink-violet/5"
    >
      {ok ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {ok ? tr('Disalin') : tr('Salin')}
      <span className="sr-only" role="status">
        {ok ? `${label} disalin` : ''}
      </span>
    </button>
  )
}

const LANGKAH = {
  qris: [
    tr('Buka aplikasi bank atau e-wallet yang punya menu QRIS.'),
    tr('Pindai kode QR di atas.'),
    tr('Periksa nama penerima dan jumlah, lalu bayar.'),
  ],
  va: [
    tr('Buka m-banking, internet banking, atau ATM bank yang sama.'),
    tr('Pilih Transfer ke Virtual Account.'),
    tr('Masukkan nomor di atas, periksa jumlah, lalu bayar.'),
  ],
  mandiri: [
    tr('Buka Livin’ by Mandiri atau ATM Mandiri.'),
    tr('Pilih Bayar → Multipayment, masukkan kode perusahaan.'),
    tr('Masukkan kode bayar, periksa jumlah, lalu bayar.'),
  ],
  ewallet: [
    tr('Ketuk tombol untuk membuka aplikasinya.'),
    tr('Periksa jumlah, lalu konfirmasi pembayaran.'),
    tr('Kembali ke sini; status diperbarui otomatis.'),
  ],
}

/**
 * Instruksi bayar Midtrans Core API (T-113): QR (QRIS), nomor virtual account, atau tombol buka
 * e-wallet, dengan hitung mundur batas bayar. Status diperbarui otomatis oleh halaman induk.
 */
export default function InstruksiBayar({ payment, onCek, memeriksa, desktop = false }) {
  const ins = payment.instruksi
  const batas = payment.batasBayar ? new Date(payment.batasBayar).getTime() : null
  const now = useSekarang(Boolean(batas))
  const sisa = batas ? batas - now : null
  const habis = sisa !== null && sisa <= 0
  const mendesak = sisa !== null && sisa > 0 && sisa < 3 * 60_000

  useEffect(() => {
    if (habis) onCek?.()
    // Sekali saat waktu habis: minta status terbaru (Midtrans akan menandai kedaluwarsa).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habis])

  if (!ins) return null
  const mandiri = ins.metode === 'mandiri'
  const langkah = ins.grup === 'va' ? (mandiri ? LANGKAH.mandiri : LANGKAH.va) : LANGKAH[ins.grup]
  const namaEwallet = ins.metode === 'shopeepay' ? 'ShopeePay' : 'GoPay'

  return (
    <section
      aria-labelledby="judul-bayar"
      className="rounded-[1.75rem] bg-card p-5 shadow-[0_16px_40px_-24px_rgb(65_57_111/0.6)] ring-1 ring-ink-violet/10 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="judul-bayar" className="text-[15px] font-semibold text-[#8A5300]">
          {tr('Menunggu pembayaran')}
        </h2>
        <p className="text-[13px] text-ink/60">{namaMetode(ins.metode)}</p>
      </div>

      {batas && (
        <div className="mt-2" aria-live="off">
          <p className="text-[13px] text-ink/60">{habis ? tr('Batas bayar sudah lewat') : tr('Bayar sebelum waktu habis')}</p>
          <p
            className={`font-serif text-[3rem] leading-none tabular-nums ${habis ? 'text-ink/40' : mendesak ? 'text-traffic-macet' : 'text-ink-violet'}`}
            role="timer"
            aria-label={habis ? tr('Waktu bayar habis') : tr("Sisa waktu {0}", { 0: sisaWaktu(sisa) })}
          >
            {sisaWaktu(sisa)}
          </p>
          <p className="mt-1 text-[13px] text-ink/60">{tr('Batas:')} {waktuLengkap(payment.batasBayar)}</p>
        </div>
      )}

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-dashed border-ink-violet/25 pt-4">
        <div>
          <p className="text-[13px] text-ink/60">{tr('Total bayar')}</p>
          <p className="font-serif text-[1.75rem] leading-tight">{rupiah(payment.jumlah)}</p>
        </div>
        <TombolSalin teks={String(payment.jumlah)} label={tr('jumlah')} />
      </div>

      {!habis && ins.grup === 'qris' && (
        <div className="mt-5 flex flex-col items-center">
          <div className="tema-terang rounded-2xl bg-white p-3 ring-1 ring-ink/10">
            {ins.qrString ? (
              <KodeQR value={ins.qrString} size={220} label={tr('Kode QRIS untuk dibayar')} />
            ) : (
              <img src={ins.qrUrl} alt={tr('Kode QRIS untuk dibayar')} width={220} height={220} className="size-[220px]" />
            )}
          </div>
          <p className="mt-2 text-[13px] text-ink/60">{tr('QRIS, bisa dipindai semua aplikasi pembayaran')}</p>
        </div>
      )}

      {!habis && ins.grup === 'va' && (
        <dl className="mt-5 space-y-4">
          {mandiri ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <dt className="text-[13px] text-ink/60">{tr('Kode perusahaan')}</dt>
                  <dd className="font-serif text-[1.625rem] tracking-[0.06em] tabular-nums">{ins.kodePerusahaan}</dd>
                </div>
                <TombolSalin teks={ins.kodePerusahaan} label={tr('kode perusahaan')} />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <dt className="text-[13px] text-ink/60">{tr('Kode bayar')}</dt>
                  <dd className="break-all font-serif text-[1.625rem] tracking-[0.06em] tabular-nums">{ins.kodeBayar}</dd>
                </div>
                <TombolSalin teks={ins.kodeBayar} label={tr('kode bayar')} />
              </div>
            </>
          ) : (
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <dt className="text-[13px] text-ink/60">{tr('Nomor virtual account')} {String(ins.bank ?? '').toUpperCase()}</dt>
                <dd className="break-all font-serif text-[1.625rem] tracking-[0.06em] tabular-nums">{ins.nomorVa}</dd>
              </div>
              <TombolSalin teks={ins.nomorVa} label={tr('nomor virtual account')} />
            </div>
          )}
        </dl>
      )}

      {!habis && ins.grup === 'ewallet' && (
        <div className="mt-5 flex flex-col items-center gap-4">
          {ins.deeplink && (
            <a
              href={ins.deeplink}
              className="bg-pill inline-flex min-h-touch items-center gap-2 rounded-full px-6 font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]"
            >
              <Smartphone size={18} aria-hidden="true" /> {tr('Buka')} {namaEwallet}
            </a>
          )}
          {desktop && ins.qrUrl && (
            <div className="flex flex-col items-center">
              <div className="tema-terang rounded-2xl bg-white p-3 ring-1 ring-ink/10">
                <img src={ins.qrUrl} alt={tr("Kode QR {0}", { 0: namaEwallet })} width={200} height={200} className="size-[200px]" />
              </div>
              <p className="mt-2 text-[13px] text-ink/60">{tr('Di komputer? Pindai dengan aplikasi')} {namaEwallet} {tr('di ponsel.')}</p>
            </div>
          )}
        </div>
      )}

      {!habis && langkah && (
        <ol className="mt-5 space-y-2 text-[14px] leading-snug text-ink/80">
          {langkah.map((l, i) => (
            <li key={l} className="flex gap-3">
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-full bg-lilac-wash/40 text-[12px] font-bold text-ink-violet"
              >
                {i + 1}
              </span>
              {l}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink/[0.07] pt-4">
        <p className="flex flex-1 items-center gap-2 text-[13px] text-ink/65">
          <span aria-hidden="true" className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-traffic-lancar/60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-traffic-lancar" />
          </span>
          {tr('Status diperbarui otomatis')}
        </p>
        <button
          type="button"
          onClick={onCek}
          disabled={memeriksa}
          className="inline-flex min-h-touch items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-violet ring-1 ring-ink-violet/25 hover:bg-ink-violet/5 disabled:opacity-60"
        >
          {memeriksa ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={16} aria-hidden="true" />
          )}
          {tr('Cek sekarang')}
        </button>
      </div>
      <p className="mt-3 text-[12px] text-ink/55">
        {tr('Ini simulasi; tidak ada uang sungguhan. Untuk uji coba, bayar lewat')}{' '}
        <a
          href={SIMULATOR_MIDTRANS}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-ink-violet underline"
        >
          {tr('simulator Midtrans sandbox')} <ExternalLink size={12} aria-hidden="true" />
        </a>
        .
      </p>
    </section>
  )
}
