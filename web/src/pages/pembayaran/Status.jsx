import { useEffect, useRef, useState } from 'react'
import { CircleAlert, Clock3, ExternalLink, Loader2, Printer, RefreshCw, Share2, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PageShell from '../../components/PageShell.jsx'
import ETiket from '../../components/pembayaran/ETiket.jsx'
import PitaSimulasi from '../../components/pembayaran/PitaSimulasi.jsx'
import { api } from '../../lib/api.js'
import { STATUS, bagikan, rupiah, ruteLayanan, satuanLabel, teksBagikan, waktuLengkap } from '../../lib/pembayaran.js'

/**
 * Status & e-tiket satu pesanan (/pembayaran/:orderId). Midtrans mengembalikan pengguna ke sini
 * setelah membayar; status yang masih menunggu langsung dicek sekali ke server (POST …/cek).
 */
export default function StatusPembayaran() {
  const { orderId } = useParams()
  const [state, setState] = useState({
    payment: null,
    error: null,
    cek: false,
  })
  const [pesan, setPesan] = useState(null)
  const sudahCek = useRef(false)

  async function cek() {
    setState((s) => ({ ...s, cek: true, error: null }))
    try {
      const { payment } = await api.post(`/payments/${encodeURIComponent(orderId)}/cek`)
      setState({ payment, error: null, cek: false })
    } catch (error) {
      setState((s) => ({ ...s, error, cek: false }))
    }
  }

  useEffect(() => {
    const ctrl = new AbortController()
    api.get(`/payments/${encodeURIComponent(orderId)}`, { signal: ctrl.signal }).then(
      ({ payment }) => {
        setState({ payment, error: null, cek: false })
        if (payment.status === 'menunggu' && !sudahCek.current) {
          sudahCek.current = true
          cek()
        }
      },
      (error) => error.name !== 'AbortError' && setState({ payment: null, error, cek: false }),
    )
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const p = state.payment

  async function bagi() {
    const hasil = await bagikan(teksBagikan(p))
    if (hasil === 'disalin') setPesan('Detail e-tiket disalin.')
  }

  return (
    <PageShell
      title={p?.status === 'lunas' ? 'E-tiket' : 'Status pembayaran'}
      backTo="/pembayaran/riwayat"
      backLabel="Kembali ke riwayat"
    >
      <div className="mx-auto w-full max-w-xl pt-6 lg:pt-10">
        <PitaSimulasi className="mb-6 print:hidden" />
        {!p && !state.error && (
          <div className="mx-auto h-96 max-w-[26rem] animate-pulse rounded-[1.75rem] bg-ink/[0.06]" aria-label="Memuat" />
        )}
        {!p && state.error && <ErrorBanner error={state.error} />}

        {p?.status === 'lunas' && (
          <>
            <ETiket payment={p} />
            {p.poin > 0 && (
              <p className="mt-5 flex items-center justify-center gap-2 text-[15px] font-semibold text-ink-violet">
                <Sparkles size={18} className="text-pill-via" aria-hidden="true" />+{p.poin} poin masuk ke Rewards
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-3 print:hidden">
              <button
                type="button"
                onClick={bagi}
                className="bg-pill flex min-h-touch items-center gap-2 rounded-full px-6 font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]"
              >
                <Share2 size={18} aria-hidden="true" /> Bagikan
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-touch items-center gap-2 rounded-full px-5 font-semibold text-ink-violet ring-1 ring-ink-violet/30 hover:bg-ink-violet/5"
              >
                <Printer size={18} aria-hidden="true" /> Cetak
              </button>
            </div>
            {pesan && (
              <p role="status" className="mt-2 text-center text-sm text-ink/70">
                {pesan}
              </p>
            )}
          </>
        )}

        {p && p.status !== 'lunas' && <BelumLunas p={p} cek={cek} memeriksa={state.cek} error={state.error} />}
      </div>
    </PageShell>
  )
}

function BelumLunas({ p, cek, memeriksa, error }) {
  const menunggu = p.status === 'menunggu'
  const Ikon = menunggu ? Clock3 : CircleAlert
  return (
    <section className="rounded-[1.75rem] bg-card p-6 shadow-[0_16px_40px_-24px_rgb(65_57_111/0.6)] ring-1 ring-ink-violet/10">
      <p className={`flex items-center gap-2 text-[15px] font-semibold ${menunggu ? 'text-[#8A5300]' : 'text-ink/70'}`}>
        <Ikon size={20} aria-hidden="true" />
        {STATUS[p.status]?.label ?? p.status}
      </p>
      <h2 className="mt-2 font-serif text-[1.5rem] leading-tight">{p.layanan.nama}</h2>
      <p className="mt-1 text-[14px] text-ink/65">{ruteLayanan(p.layanan)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px]">
        <div className="col-span-2">
          <dt className="text-ink/55">Jadwal</dt>
          <dd className="font-semibold">{p.jadwal ? waktuLengkap(p.jadwal) : '—'}</dd>
        </div>
        <div>
          <dt className="text-ink/55">Jumlah</dt>
          <dd className="font-semibold">
            {p.penumpang} {satuanLabel(p.layanan)}
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">Total</dt>
          <dd className="font-semibold">{rupiah(p.jumlah)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink/55">No. pesanan</dt>
          <dd className="font-semibold">{p.orderId}</dd>
        </div>
      </dl>

      <p className="mt-5 text-[15px] leading-relaxed text-ink/75">
        {menunggu
          ? 'Selesaikan pembayaran di halaman Midtrans (sandbox), lalu cek status di sini. E-tiket muncul setelah pembayaran lunas.'
          : p.status === 'kedaluwarsa'
            ? 'Batas waktu pembayaran sudah lewat. Buat pesanan baru kalau masih mau berangkat.'
            : 'Pembayaran tidak berhasil. Buat pesanan baru untuk mencoba lagi.'}
      </p>
      {error && <ErrorBanner error={error} className="mt-4" />}

      <div className="mt-5 flex flex-wrap gap-3">
        {menunggu ? (
          <>
            <button
              type="button"
              onClick={cek}
              disabled={memeriksa}
              className="bg-pill flex min-h-touch items-center gap-2 rounded-full px-6 font-semibold text-white disabled:opacity-60"
            >
              {memeriksa ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={18} aria-hidden="true" />
              )}
              Cek status
            </button>
            {p.redirectUrl && (
              <a
                href={p.redirectUrl}
                className="flex min-h-touch items-center gap-2 rounded-full px-5 font-semibold text-ink-violet ring-1 ring-ink-violet/30 hover:bg-ink-violet/5"
              >
                <ExternalLink size={18} aria-hidden="true" /> Lanjutkan bayar
              </a>
            )}
          </>
        ) : (
          <Link to="/pembayaran" className="bg-pill flex min-h-touch items-center rounded-full px-6 font-semibold text-white">
            Pesan lagi
          </Link>
        )}
      </div>
    </section>
  )
}
