import KodeQR from './KodeQR.jsx'
import { IKON_JENIS } from './ikon.js'
import { labelJenis, namaMetode, rupiah, satuanLabel, waktuLengkap } from '../../lib/pembayaran.js'
import { tr } from '../../lib/i18n.js'

/**
 * E-tiket simulasi (DESIGN §3): kode + QR, detail perjalanan, cap besar "SIMULASI – bukan tiket resmi".
 * Bentuk tiket sobek: kepala ungu bertekstur, garis perforasi bertakik, badan putih berisi QR.
 */
export default function ETiket({ payment }) {
  const { layanan, eTiket } = payment
  const Ikon = IKON_JENIS[layanan.jenis] ?? IKON_JENIS.kereta
  const parkir = layanan.jenis === 'parkir'

  return (
    <article
      aria-label={tr("E-tiket simulasi {0}", { 0: layanan.nama })}
      className="cetak-tiket tema-terang relative mx-auto w-full max-w-[26rem] overflow-hidden rounded-[1.75rem] bg-white shadow-[0_20px_40px_-20px_rgb(65_57_111/0.65)] ring-1 ring-ink-violet/10 print:shadow-none"
    >
      <header className="cetak-tiket-kepala bg-pill-deep grain relative px-6 pb-6 pt-5 text-white">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-white/85">
          <Ikon size={16} aria-hidden="true" />
          {labelJenis(layanan.jenis)}
          {layanan.operator ? `, ${layanan.operator}` : ''}
        </p>
        <h2 className="mt-1.5 font-serif text-[1.625rem] leading-tight">{layanan.nama}</h2>
        {!parkir && layanan.tujuan && (
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-[15px]">
            <span className="truncate">{layanan.asal}</span>
            <span aria-hidden="true" className="flex items-center">
              <span className="size-2 rounded-full border-2 border-white" />
              <span className="w-8 border-t-2 border-dotted border-white/70" />
              <span className="size-2 rounded-full bg-white" />
            </span>
            <span className="truncate text-right font-semibold">{layanan.tujuan}</span>
          </div>
        )}
        {parkir && layanan.asal && <p className="mt-3 text-[15px]">{layanan.asal}</p>}
      </header>

      {/* Perforasi: dua takik setengah lingkaran + garis putus-putus. */}
      <div aria-hidden="true" className="relative h-0">
        <span className="takik absolute -left-3 -top-3 size-6 rounded-full bg-surface ring-1 ring-ink-violet/10 dark:bg-[#15101E]" />
        <span className="takik absolute -right-3 -top-3 size-6 rounded-full bg-surface ring-1 ring-ink-violet/10 dark:bg-[#15101E]" />
        <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-ink-violet/20" />
      </div>

      <div className="relative px-6 pb-6 pt-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
          <div className="col-span-2">
            <dt className="text-ink/55">{parkir ? tr('Mulai parkir') : tr('Berangkat')}</dt>
            <dd className="font-semibold">{payment.jadwal ? waktuLengkap(payment.jadwal) : '—'}</dd>
          </div>
          <div>
            <dt className="text-ink/55">{parkir ? tr('Lama') : tr('Penumpang')}</dt>
            <dd className="font-semibold">
              {payment.penumpang} {satuanLabel(layanan)}
            </dd>
          </div>
          <div>
            <dt className="text-ink/55">{tr('Total')}</dt>
            <dd className="font-semibold">{rupiah(payment.jumlah)}</dd>
          </div>
          {payment.metode && (
            <div>
              <dt className="text-ink/55">{tr('Metode')}</dt>
              <dd className="font-semibold">{namaMetode(payment.metode)}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-ink/55">{tr('No. pesanan')}</dt>
            <dd className="break-all font-semibold">{payment.orderId}</dd>
          </div>
        </dl>

        {/* Cap karet: besar & miring supaya e-tiket tidak bisa dikira tiket resmi. */}
        <p className="mt-6 flex justify-center">
          <span className="inline-flex -rotate-[6deg] flex-col items-center rounded-xl border-[3px] border-pill-via px-5 py-1.5 text-pill-via">
            <span className="font-serif text-[1.875rem] leading-none tracking-[0.12em]">{tr('SIMULASI')}</span>
            <span className="mt-0.5 text-[0.8125rem] font-bold">{tr('bukan tiket resmi')}</span>
          </span>
        </p>

        <div className="mt-5 flex flex-col items-center">
          <KodeQR value={`${eTiket.kode}|${payment.orderId}|SIMULASI`} label={tr("Kode QR e-tiket simulasi {0}", { 0: eTiket.kode })} />
          <p className="mt-2 font-serif text-[1.375rem] tracking-[0.08em] text-ink-violet">{eTiket.kode}</p>
        </div>

      </div>
    </article>
  )
}
