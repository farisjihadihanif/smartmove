import { useState } from 'react'
import { Check, Copy, Gift, Loader2, MessageSquareHeart, TicketCheck, TicketPercent } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import PageShell from '../components/PageShell.jsx'
import PillToggle from '../components/PillToggle.jsx'
import { api } from '../lib/api.js'
import { useApiGet } from '../lib/useApiGet.js'
import { jamAtauTanggal } from '../lib/wib.js'

const TAB = [
  { value: 'tukar', label: 'Tukar poin' },
  { value: 'saya', label: 'Voucher saya' },
  { value: 'riwayat', label: 'Riwayat' },
]
const poin = (n) => n.toLocaleString('id-ID')
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tanggal = (iso) => {
  const w = new Date(new Date(iso).getTime() + 7 * 3600_000)
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}`
}

/**
 * Rewards (DESIGN §3, PRD §6.4, T-304): saldo poin, tukar voucher, voucher saya, riwayat poin.
 * Voucher digambar sebagai kupon sobek (bahasa visual yang sama dengan e-tiket).
 */
export default function Rewards() {
  const [tab, setTab] = useState('tukar')
  const ringkas = useApiGet('/rewards', { limit: 1 })
  const [saldoBaru, setSaldoBaru] = useState(null)
  const saldo = saldoBaru ?? ringkas.data?.saldo

  return (
    <PageShell
      title="Rewards"
      toolbar={<PillToggle options={TAB} value={tab} onChange={setTab} label="Bagian Rewards" fitDesktop />}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pt-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10 lg:pt-8">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section aria-labelledby="judul-saldo" className="bg-trip-card grain relative overflow-hidden rounded-[1.75rem] px-5 py-5 text-white shadow-[0_14px_30px_-16px_rgb(95_63_115/0.9)] lg:px-6 lg:py-7">
            <h2 id="judul-saldo" className="font-serif text-[15px] text-white/90 drop-shadow-[0_1px_2px_rgb(65_57_111/0.35)]">
              Poin kamu
            </h2>
            {saldo === undefined ? (
              <span className="mt-1 block h-14 w-32 animate-pulse rounded-xl bg-white/25" aria-label="Memuat saldo" />
            ) : (
              <p className="font-serif text-[3.5rem] leading-none tracking-tight drop-shadow-[0_1px_2px_rgb(65_57_111/0.35)] lg:text-[4.5rem]">
                {poin(saldo)}
              </p>
            )}
          </section>
          <section aria-labelledby="judul-cara" className="mt-5 px-1">
            <h2 id="judul-cara" className="text-sm font-bold">
              Cara dapat poin
            </h2>
            <ul className="mt-2 space-y-3 text-[14px] leading-snug text-ink/75">
              <li className="flex gap-3">
                <TicketCheck size={20} className="mt-0.5 shrink-0 text-pill-via" aria-hidden="true" />
                <span>
                  <Link to="/pembayaran" className="font-semibold text-ink-violet hover:underline">
                    Pesan tiket atau parkir
                  </Link>
                  : 1 poin tiap Rp1.000 setelah lunas (simulasi).
                </span>
              </li>
              <li className="flex gap-3">
                <MessageSquareHeart size={20} className="mt-0.5 shrink-0 text-pill-via" aria-hidden="true" />
                <span>
                  <Link to="/kampanye/umpan-balik" className="font-semibold text-ink-violet hover:underline">
                    Kirim umpan balik
                  </Link>
                  : 5 poin, sekali seminggu.
                </span>
              </li>
            </ul>
          </section>
        </aside>

        <div className="min-w-0">
          {tab === 'tukar' && <Katalog saldo={saldo} onDitukar={(s) => setSaldoBaru(s)} onLihatSaya={() => setTab('saya')} />}
          {tab === 'saya' && <VoucherSaya />}
          {tab === 'riwayat' && <Riwayat />}
        </div>
      </div>
    </PageShell>
  )
}

/** Kupon: sobekan kiri berisi harga poin, takik di sambungan, isi di kanan. */
function Kupon({ kiri, children, redup = false }) {
  return (
    <div
      className={`relative grid grid-cols-[5.5rem_minmax(0,1fr)] overflow-hidden rounded-[1.25rem] bg-card ring-1 ring-ink-violet/12 ${
        redup ? 'opacity-60' : 'shadow-[0_10px_24px_-18px_rgb(65_57_111/0.7)]'
      }`}
    >
      <div className="bg-pill-deep grain flex flex-col items-center justify-center px-2 py-4 text-center text-white">{kiri}</div>
      <span aria-hidden="true" className="absolute left-[5.5rem] top-0 h-full border-l-2 border-dashed border-white/0">
        <span className="absolute -left-[0.6rem] -top-2.5 size-5 rounded-full bg-surface" />
        <span className="absolute -bottom-2.5 -left-[0.6rem] size-5 rounded-full bg-surface" />
      </span>
      <div className="min-w-0 px-4 py-3.5">{children}</div>
    </div>
  )
}

function Katalog({ saldo, onDitukar, onLihatSaya }) {
  const { status, data, error, muatUlang } = useApiGet('/rewards/vouchers')
  const [yakin, setYakin] = useState(null)
  const [kirim, setKirim] = useState({ id: null, error: null })
  const [hasil, setHasil] = useState(null)

  async function tukar(v) {
    setKirim({ id: v.id, error: null })
    try {
      const res = await api.post(`/rewards/vouchers/${v.id}/redeem`)
      setHasil(res.redemption)
      onDitukar(res.saldo)
      setYakin(null)
      setKirim({ id: null, error: null })
      muatUlang()
    } catch (error) {
      setKirim({ id: null, error })
      setYakin(null)
      if (error.code === 'STOK_HABIS') muatUlang()
    }
  }

  return (
    <section aria-labelledby="judul-katalog">
      <h2 id="judul-katalog" className="font-serif text-[1.5rem] leading-tight">
        Tukar poin
      </h2>
      {hasil && (
        <div role="status" className="sheet-fade mt-4 rounded-[1.25rem] bg-traffic-lancar/10 px-4 py-4 ring-1 ring-traffic-lancar/35">
          <p className="font-semibold text-[#1D6B3D]">Voucher ditukar: {hasil.voucher?.nama}</p>
          <p className="mt-1 font-serif text-[1.5rem] tracking-[0.06em] text-ink-violet">{hasil.kode}</p>
          <button type="button" onClick={onLihatSaya} className="mt-1 min-h-touch text-sm font-semibold text-ink-violet hover:underline">
            Lihat di Voucher saya
          </button>
        </div>
      )}
      {kirim.error && (
        <ErrorBanner
          message={kirim.error.code === 'POIN_KURANG' ? 'Poinmu belum cukup untuk voucher ini.' : undefined}
          error={kirim.error.code === 'POIN_KURANG' ? undefined : kirim.error}
          onDismiss={() => setKirim({ id: null, error: null })}
          className="mt-4"
        />
      )}
      {status === 'galat' && <ErrorBanner error={error} onRetry={muatUlang} className="mt-4" />}
      {status === 'memuat' && <div className="mt-4 h-40 animate-pulse rounded-[1.25rem] bg-ink/[0.06]" aria-label="Memuat voucher" />}
      {status === 'ok' && data.items.length === 0 && (
        <EmptyState icon={Gift} title="Belum ada voucher" message="Voucher baru akan muncul di sini. Sambil menunggu, kumpulkan poinnya dulu." className="mt-6" />
      )}
      {status === 'ok' && data.items.length > 0 && (
        <ul className="mt-4 grid gap-4 xl:grid-cols-2">
          {data.items.map((v) => {
            const kurang = saldo !== undefined && saldo < v.poin
            const bisa = v.tersedia && !kurang
            return (
              <li key={v.id}>
                <Kupon
                  redup={!v.tersedia}
                  kiri={
                    <>
                      <span className="font-serif text-[1.625rem] leading-none">{poin(v.poin)}</span>
                      <span className="mt-1 text-[12px] font-semibold text-white/85">poin</span>
                    </>
                  }
                >
                  <p className="font-semibold leading-snug">{v.nama}</p>
                  {v.deskripsi && <p className="mt-0.5 text-[13px] leading-snug text-ink/65">{v.deskripsi}</p>}
                  <p className="mt-1 text-[12px] text-ink/55">
                    {v.tersedia ? `Sisa ${v.stok}` : 'Stok habis'}
                    {v.berlakuSampai ? `, berlaku sampai ${tanggal(v.berlakuSampai)}` : ''}
                  </p>
                  {v.syarat && (
                    <details className="mt-1 text-[12px] text-ink/65">
                      <summary className="cursor-pointer py-1 font-semibold text-ink-violet">Syarat</summary>
                      <p className="whitespace-pre-line leading-snug">{v.syarat}</p>
                    </details>
                  )}
                  <div className="mt-2">
                    {yakin === v.id ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => tukar(v)}
                          disabled={kirim.id === v.id}
                          className="bg-pill inline-flex min-h-touch items-center gap-2 rounded-full px-4 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {kirim.id === v.id && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                          Tukar {poin(v.poin)} poin?
                        </button>
                        <button type="button" onClick={() => setYakin(null)} className="min-h-touch rounded-full px-3 text-sm font-semibold text-ink/65 hover:bg-ink/5">
                          Batal
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!bisa}
                        onClick={() => setYakin(v.id)}
                        className="inline-flex min-h-touch items-center rounded-full px-4 text-sm font-semibold text-ink-violet ring-1 ring-ink-violet/30 transition hover:bg-ink-violet/5 disabled:text-ink/45 disabled:ring-ink/15 disabled:hover:bg-transparent"
                      >
                        {!v.tersedia ? 'Habis' : kurang ? `Kurang ${poin(v.poin - saldo)} poin` : 'Tukar'}
                      </button>
                    )}
                  </div>
                </Kupon>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const STATUS_VOUCHER = {
  aktif: { label: 'Bisa dipakai', kelas: 'bg-traffic-lancar/12 text-[#1D6B3D] ring-traffic-lancar/40' },
  dipakai: { label: 'Sudah dipakai', kelas: 'bg-ink/[0.05] text-ink/65 ring-ink/15' },
  kedaluwarsa: { label: 'Kedaluwarsa', kelas: 'bg-ink/[0.05] text-ink/65 ring-ink/15' },
}

function VoucherSaya() {
  const [page, setPage] = useState(1)
  const { status, data, error, muatUlang } = useApiGet('/rewards/redemptions', { page })
  const [disalin, setDisalin] = useState(null)

  async function salin(kode) {
    try {
      await navigator.clipboard.writeText(kode)
      setDisalin(kode)
    } catch {
      setDisalin(null)
    }
  }

  return (
    <section aria-labelledby="judul-saya">
      <h2 id="judul-saya" className="font-serif text-[1.5rem] leading-tight">
        Voucher saya
      </h2>
      {status === 'galat' && <ErrorBanner error={error} onRetry={muatUlang} className="mt-4" />}
      {status === 'memuat' && <div className="mt-4 h-40 animate-pulse rounded-[1.25rem] bg-ink/[0.06]" aria-label="Memuat voucher saya" />}
      {status === 'ok' && data.items.length === 0 && (
        <EmptyState icon={TicketPercent} title="Belum ada voucher" message="Tukar poinmu di Tukar poin, vouchernya tersimpan di sini." className="mt-6" />
      )}
      {status === 'ok' && data.items.length > 0 && (
        <ul className="mt-4 grid gap-4 xl:grid-cols-2">
          {data.items.map((r) => {
            const st = STATUS_VOUCHER[r.status] ?? STATUS_VOUCHER.dipakai
            return (
              <li key={r.id}>
                <Kupon
                  redup={r.status !== 'aktif'}
                  kiri={<TicketPercent size={30} strokeWidth={1.75} aria-hidden="true" />}
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold leading-snug">{r.voucher?.nama ?? 'Voucher'}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${st.kelas}`}>{st.label}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-2">
                    <span className="font-serif text-[1.375rem] tracking-[0.06em] text-ink-violet">{r.kode}</span>
                    <button
                      type="button"
                      onClick={() => salin(r.kode)}
                      aria-label={`Salin kode ${r.kode}`}
                      className="grid size-touch place-items-center rounded-full text-ink-violet hover:bg-ink-violet/[0.07]"
                    >
                      {disalin === r.kode ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                    </button>
                  </p>
                  <p className="text-[12px] text-ink/55">
                    Ditukar {tanggal(r.createdAt)}
                    {r.voucher?.berlakuSampai ? `, berlaku sampai ${tanggal(r.voucher.berlakuSampai)}` : ''}
                  </p>
                  {r.voucher?.syarat && (
                    <details className="mt-1 text-[12px] text-ink/65">
                      <summary className="cursor-pointer py-1 font-semibold text-ink-violet">Syarat</summary>
                      <p className="whitespace-pre-line leading-snug">{r.voucher.syarat}</p>
                    </details>
                  )}
                </Kupon>
              </li>
            )
          })}
        </ul>
      )}
      {disalin && (
        <p role="status" className="sr-only">
          Kode {disalin} disalin
        </p>
      )}
      {data && data.total > 20 && (
        <div className="mt-4 flex justify-between">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-touch px-4 font-semibold text-ink-violet disabled:opacity-35">
            Sebelumnya
          </button>
          <button type="button" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)} className="min-h-touch px-4 font-semibold text-ink-violet disabled:opacity-35">
            Berikutnya
          </button>
        </div>
      )}
    </section>
  )
}

function Riwayat() {
  const [page, setPage] = useState(1)
  const { status, data, error, muatUlang } = useApiGet('/rewards', { page })
  const [now] = useState(() => Date.now())

  return (
    <section aria-labelledby="judul-riwayat">
      <h2 id="judul-riwayat" className="font-serif text-[1.5rem] leading-tight">
        Riwayat poin
      </h2>
      {status === 'galat' && <ErrorBanner error={error} onRetry={muatUlang} className="mt-4" />}
      {status === 'memuat' && <div className="mt-4 h-40 animate-pulse rounded-[1.25rem] bg-ink/[0.06]" aria-label="Memuat riwayat" />}
      {status === 'ok' && data.items.length === 0 && (
        <EmptyState icon={Gift} title="Belum ada poin" message="Poin pertamamu datang dari pemesanan yang lunas atau umpan balik." className="mt-6" />
      )}
      {status === 'ok' && data.items.length > 0 && (
        <ul className="mt-3">
          {data.items.map((l) => {
            const tambah = l.jumlah > 0
            return (
              <li key={l.id} className="flex items-center gap-4 border-b border-ink/[0.07] py-3.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.label}</p>
                  <p className="text-[13px] text-ink/55">{jamAtauTanggal(l.createdAt, now)}</p>
                </div>
                <span className={`font-serif text-[1.25rem] tabular-nums ${tambah ? 'text-[#1D6B3D]' : 'text-ink/70'}`}>
                  {tambah ? '+' : '−'}
                  {poin(Math.abs(l.jumlah))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {data && data.total > 20 && (
        <div className="mt-4 flex justify-between">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-touch px-4 font-semibold text-ink-violet disabled:opacity-35">
            Sebelumnya
          </button>
          <button type="button" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)} className="min-h-touch px-4 font-semibold text-ink-violet disabled:opacity-35">
            Berikutnya
          </button>
        </div>
      )}
    </section>
  )
}
