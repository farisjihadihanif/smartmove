import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, Printer, Share2, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PageShell from '../../components/PageShell.jsx'
import ETiket from '../../components/pembayaran/ETiket.jsx'
import InstruksiBayar from '../../components/pembayaran/InstruksiBayar.jsx'
import PitaSimulasi from '../../components/pembayaran/PitaSimulasi.jsx'
import { api } from '../../lib/api.js'
import { STATUS, bagikan, rupiah, ruteLayanan, satuanLabel, teksBagikan, waktuLengkap } from '../../lib/pembayaran.js'
import { useMediaQuery } from '../../lib/useNotifications.js'
import { tr } from '../../lib/i18n.js'
import { revealUp } from '../../lib/reveal.js'

const SELANG_MS = 5000 // baca status dari server SmartMove
const CEK_TIAP = 3 // tiap 3 kali (±15 dtk) minta server menanyakan Midtrans (webhook tak sampai ke dev)

/**
 * Status, instruksi bayar, dan e-tiket satu pesanan (/pembayaran/:orderId, T-113).
 * Selama menunggu: QR / nomor VA / tombol e-wallet + hitung mundur; status diperbarui otomatis
 * dan e-tiket muncul begitu lunas.
 */
export default function StatusPembayaran() {
  const { orderId } = useParams()
  const desktop = useMediaQuery('(min-width: 64rem)')
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState(null)
  const [memeriksa, setMemeriksa] = useState(false)
  const [pesan, setPesan] = useState(null)
  const [baruLunas, setBaruLunas] = useState(false)
  const statusLama = useRef(null)
  const path = `/payments/${encodeURIComponent(orderId)}`

  const terima = useCallback((p) => {
    if (statusLama.current === 'menunggu' && p.status === 'lunas') setBaruLunas(true)
    statusLama.current = p.status
    setPayment(p)
    setError(null)
  }, [])

  const cek = useCallback(
    async ({ diam = false } = {}) => {
      if (!diam) setMemeriksa(true)
      try {
        terima((await api.post(`${path}/cek`)).payment)
      } catch (e) {
        if (!diam) setError(e)
      } finally {
        if (!diam) setMemeriksa(false)
      }
    },
    [path, terima],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    api.get(path, { signal: ctrl.signal }).then(
      ({ payment: p }) => {
        terima(p)
        if (p.status === 'menunggu') cek({ diam: true })
      },
      (e) => e.name !== 'AbortError' && setError(e),
    )
    return () => ctrl.abort()
  }, [path, terima, cek])

  // Pembaruan otomatis selama menunggu (berhenti saat tab disembunyikan).
  const menunggu = payment?.status === 'menunggu'
  useEffect(() => {
    if (!menunggu) return undefined
    let ke = 0
    const t = setInterval(async () => {
      if (document.visibilityState === 'hidden') return
      ke += 1
      try {
        if (ke % CEK_TIAP === 0) await cek({ diam: true })
        else terima((await api.get(path)).payment)
      } catch {
        // Diam: dicoba lagi di putaran berikutnya.
      }
    }, SELANG_MS)
    return () => clearInterval(t)
  }, [menunggu, path, cek, terima])

  const p = payment

  async function bagi() {
    const hasil = await bagikan(teksBagikan(p))
    if (hasil === 'disalin') setPesan(tr('Detail e-tiket disalin.'))
  }

  return (
    <PageShell
      title={p?.status === 'lunas' ? tr('E-tiket') : tr('Pembayaran')}
      backTo="/pembayaran/riwayat"
      backLabel={tr('Kembali ke riwayat')}
    >
      <div className="mx-auto w-full max-w-xl pt-6 lg:pt-10">
        <PitaSimulasi className="mb-6 print:hidden" />
        {!p && !error && (
          <div className="mx-auto h-96 max-w-[26rem] animate-pulse rounded-[1.75rem] bg-ink/[0.06]" aria-label={tr('Memuat')} />
        )}
        {!p && error && <ErrorBanner error={error} />}

        {p?.status === 'lunas' && (
          <div className={baruLunas ? 'sheet-fade' : ''}>
            {baruLunas && (
              <p role="status" className="mb-4 text-center font-serif text-[1.375rem] text-[#1D6B3D] print:hidden">
                {tr('Pembayaran diterima. Ini e-tiketmu.')}
              </p>
            )}
            <ETiket payment={p} />
            {p.poin > 0 && (
              <p className="mt-5 flex items-center justify-center gap-2 text-[15px] font-semibold text-ink-violet print:hidden">
                <Sparkles size={18} className="text-pill-via" aria-hidden="true" />+{p.poin} {tr('poin masuk ke Rewards')}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-3 print:hidden">
              <button
                type="button"
                onClick={bagi}
                className="bg-pill flex min-h-touch items-center gap-2 rounded-full px-6 font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]"
              >
                <Share2 size={18} aria-hidden="true" /> {tr('Bagikan')}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-touch items-center gap-2 rounded-full px-5 font-semibold text-ink-violet ring-1 ring-ink-violet/30 hover:bg-ink-violet/5"
              >
                <Printer size={18} aria-hidden="true" /> {tr('Cetak')}
              </button>
            </div>
            {pesan && (
              <p role="status" className="mt-2 text-center text-sm text-ink/70">
                {pesan}
              </p>
            )}
          </div>
        )}

        {menunggu && (
          <div className="space-y-5">
            {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}
            <InstruksiBayar payment={p} onCek={() => cek()} memeriksa={memeriksa} desktop={desktop} />
            <RingkasanPesanan p={p} />
          </div>
        )}

        {p && p.status !== 'lunas' && !menunggu && <Gagal p={p} />}
      </div>
    </PageShell>
  )
}

function RingkasanPesanan({ p }) {
  return (
    <section aria-label={tr('Ringkasan pesanan')} className="px-1">
      <h2 ref={revealUp} className="font-serif text-[1.25rem] leading-tight">{p.layanan.nama}</h2>
      <p className="text-[14px] text-ink/65">{ruteLayanan(p.layanan)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
        <div className="col-span-2">
          <dt className="text-ink/55">{tr('Jadwal')}</dt>
          <dd className="font-semibold">{p.jadwal ? waktuLengkap(p.jadwal) : '—'}</dd>
        </div>
        <div>
          <dt className="text-ink/55">{tr('Jumlah')}</dt>
          <dd className="font-semibold">
            {p.penumpang} {satuanLabel(p.layanan)}
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">{tr('No. pesanan')}</dt>
          <dd className="font-semibold">{p.orderId}</dd>
        </div>
      </dl>
    </section>
  )
}

function Gagal({ p }) {
  return (
    <section className="rounded-[1.75rem] bg-card p-6 shadow-[0_16px_40px_-24px_rgb(65_57_111/0.6)] ring-1 ring-ink-violet/10">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink/70">
        <CircleAlert size={20} aria-hidden="true" />
        {STATUS[p.status]?.label ?? p.status}
      </p>
      <h2 ref={revealUp} className="mt-2 font-serif text-[1.5rem] leading-tight">{p.layanan.nama}</h2>
      <p className="mt-1 text-[14px] text-ink/65">
        {ruteLayanan(p.layanan)}, {rupiah(p.jumlah)}
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink/75">
        {p.status === 'kedaluwarsa'
          ? tr('Batas waktu pembayaran sudah lewat. Buat pesanan baru kalau masih mau berangkat.')
          : tr('Pembayaran tidak berhasil. Buat pesanan baru untuk mencoba lagi.')}
      </p>
      <Link
        to="/pembayaran"
        className="bg-pill mt-5 inline-flex min-h-touch items-center rounded-full px-6 font-semibold text-white"
      >
        {tr('Pesan lagi')}
      </Link>
    </section>
  )
}
