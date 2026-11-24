import { useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronRight, History, Loader2, Minus, Play, Plus, Search, Share2, TicketX } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import BottomActionBar from '../components/BottomActionBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import PageShell from '../components/PageShell.jsx'
import PillToggle from '../components/PillToggle.jsx'
import SearchField from '../components/SearchField.jsx'
import PitaSimulasi from '../components/pembayaran/PitaSimulasi.jsx'
import ParkirIcon from '../components/pembayaran/ParkirIcon.jsx'
import { IKON_JENIS, IKON_METODE } from '../components/pembayaran/ikon.js'
import { api } from '../lib/api.js'
import {
  JENIS,
  GRUP_METODE,
  bagikan,
  maksJumlah,
  pecahTanggal,
  rupiah,
  ruteLayanan,
  satuanLabel,
  slotParkir,
  tanggalWib,
  waktuLengkap,
} from '../lib/pembayaran.js'
import { useApiGet } from '../lib/useApiGet.js'
import kota from '../lib/kota.js'
import { useAuth } from '../lib/useAuth.js'
import { useMediaQuery } from '../lib/useNotifications.js'
import { tr } from '../lib/i18n.js'
import { revealList, revealUp } from '../lib/reveal.js'

const LANGKAH = [
  { value: 'pilih', label: tr('Pilih transportasi') },
  { value: 'biaya', label: tr('Estimasi biaya') },
]
const JUMLAH_HARI = 14

/**
 * Digital Payment (mockup hal. 5, PRD §6.3, T-302) — SELALU simulasi (Midtrans sandbox).
 * Pilih transportasi (jenis, tanggal, layanan, jam) → Estimasi biaya (jumlah, metode) → Bayar sekarang
 * membuka halaman Snap Midtrans; selesai bayar Midtrans mengembalikan ke /pembayaran/:orderId.
 * Dari Trip Planner: ?asal=&tujuan=&tanggal= menyaring layanan; tak ada yang cocok → semua layanan.
 */
export default function Pembayaran() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const desktop = useMediaQuery('(min-width: 64rem)')
  const hariIni = tanggalWib()

  const asalTrip = params.get('asal') || ''
  const tujuanTrip = params.get('tujuan') || ''
  const dariTrip = Boolean(asalTrip || tujuanTrip)
  const [semuaLayanan, setSemuaLayanan] = useState(false)
  const [tanggal, setTanggal] = useState(() => {
    const t = params.get('tanggal')
    return t && t >= hariIni ? t : hariIni
  })
  const [jenis, setJenis] = useState(params.get('jenis') || null)
  const [cari, setCari] = useState('')
  const [langkah, setLangkah] = useState('pilih')
  const [pilihan, setPilihan] = useState(null) // { kode, jam, waktu }
  const [jumlah, setJumlah] = useState(1)
  const [grupMetode, setGrupMetode] = useState(null)
  const [metode, setMetode] = useState(null)
  const [kirim, setKirim] = useState({ jalan: false, error: null })
  const [pesan, setPesan] = useState(null)

  // Dari Trip Planner: layanan yang cocok dengan rute dulu; tak ada yang cocok → semua layanan.
  const semua = useApiGet('/payments/services', { tanggal })
  const rute = useApiGet('/payments/services', dariTrip ? { tanggal, asal: asalTrip, tujuan: tujuanTrip } : { tanggal })
  const ruteCocok = dariTrip && rute.status === 'ok' && rute.data.items.length > 0
  const ruteTakCocok = dariTrip && rute.status === 'ok' && rute.data.items.length === 0
  const { status, data, error, muatUlang } = ruteCocok && !semuaLayanan ? rute : semua

  const items = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return (data?.items ?? []).filter(
      (s) =>
        (!jenis || s.jenis === jenis) && (!q || [s.nama, s.operator, s.asal, s.tujuan].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [data, jenis, cari])

  const layanan = data?.items.find((s) => s.kode === pilihan?.kode) ?? null
  const total = layanan ? layanan.harga * jumlah : 0
  const adaJadwal = Boolean(layanan && pilihan?.waktu)
  const siapBayar = adaJadwal && Boolean(metode)

  function pilihLayanan(s) {
    if (pilihan?.kode === s.kode) return
    setPilihan({ kode: s.kode, jam: null, waktu: null })
    setJumlah(1)
  }

  function pilihJam(slot) {
    setPilihan((p) => ({ ...p, jam: slot.jam, waktu: slot.waktu }))
    if (!desktop) setLangkah('biaya')
  }

  async function bayar() {
    if (!adaJadwal) {
      setLangkah('pilih')
      return
    }
    if (!metode) {
      setLangkah('biaya')
      setKirim({ jalan: false, error: { message: tr('Pilih cara bayar dulu: QRIS, virtual account, atau e-wallet.') } })
      return
    }
    if (!user) {
      navigate('/masuk', { state: { from: `/pembayaran?${params}` } })
      return
    }
    setKirim({ jalan: true, error: null })
    try {
      const res = await api.post('/payments', {
        layanan: layanan.kode,
        jadwal: pilihan.waktu,
        penumpang: jumlah,
        metode,
      })
      navigate(`/pembayaran/${res.orderId}`)
    } catch (err) {
      setKirim({ jalan: false, error: err })
    }
  }

  async function bagi() {
    const teks = layanan
      ? tr("{0} (simulasi)\n{1}\n{2}\nEstimasi {3} untuk {4} {5}\nSmartMove Medan", { 0: layanan.nama, 1: ruteLayanan(layanan), 2: pilihan?.waktu ? waktuLengkap(pilihan.waktu) : '', 3: rupiah(total), 4: jumlah, 5: satuanLabel(layanan) })
      : tr('Pesan tiket transportasi & parkir (simulasi) di SmartMove Medan')
    const hasil = await bagikan(teks)
    if (hasil === 'disalin') setPesan(tr('Ringkasan disalin.'))
  }

  const toolbar = (
    <>
      <SearchField
        value={cari}
        onChange={setCari}
        placeholder={tr('Cari layanan atau tujuan')}
        label={tr('Cari layanan')}
        leading={<Search size={20} className="text-ink-violet" aria-hidden="true" />}
        showSubmit={false}
        className="lg:w-80"
      />
      <PillToggle options={LANGKAH} value={langkah} onChange={setLangkah} label={tr('Langkah pemesanan')} className="lg:hidden" />
    </>
  )

  const pilihPanel = (
    <section aria-labelledby="judul-pilih" className={!desktop && langkah !== 'pilih' ? 'hidden' : ''}>
      <h2 id="judul-pilih" className="sr-only">
        {tr('Pilih transportasi')}
      </h2>
      {user && (
        <Link
          to="/pembayaran/riwayat"
          className="mb-1 flex min-h-touch items-center gap-2 text-sm font-semibold text-ink-violet"
        >
          <History size={18} aria-hidden="true" /> <span className="fx-line">{tr('Riwayat pemesanan')}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}

      <JenisChips value={jenis} onChange={setJenis} />
      <PitaTanggal
        value={tanggal}
        onChange={(t) => {
          setTanggal(t)
          setPilihan((p) => (p ? { ...p, jam: null, waktu: null } : p))
        }}
        hariIni={hariIni}
      />

      {ruteTakCocok && (
        <p className="mt-4 rounded-2xl bg-lilac-wash/30 px-4 py-3 text-sm leading-relaxed text-ink/80">
          {tr('Belum ada layanan untuk rute')} {asalTrip || '…'} → {tujuanTrip || '…'}{tr('. Pilih dari semua layanan di bawah.')}
        </p>
      )}
      {ruteCocok && (
        <p className="mt-4 flex flex-wrap items-center gap-x-3 rounded-2xl bg-lilac-wash/30 px-4 py-2 text-sm text-ink/80">
          <span className="flex-1 py-1">
            {semuaLayanan ? tr('Menampilkan semua layanan.') : tr("Layanan untuk rute {0} → {1}.", { 0: asalTrip || '…', 1: tujuanTrip || '…' })}
          </span>
          <button
            type="button"
            onClick={() => setSemuaLayanan(!semuaLayanan)}
            className="min-h-touch font-semibold text-ink-violet"
          >
            <span className="fx-line">{semuaLayanan ? tr('Hanya rute ini') : tr('Lihat semua')}</span>
          </button>
        </p>
      )}

      {status === 'galat' && <ErrorBanner error={error} onRetry={muatUlang} className="mt-4" />}
      {status === 'memuat' && <KerangkaDaftar />}
      {status === 'ok' && items.length === 0 && (
        <EmptyState
          icon={TicketX}
          title={tr('Layanan tidak ditemukan')}
          message={tr('Coba jenis lain atau hapus kata pencarian.')}
          className="mt-8"
        />
      )}
      {status === 'ok' && items.length > 0 && (
        <ul ref={revealList} className="mt-3">
          {items.map((s) => (
            <BarisLayanan
              key={s.kode}
              layanan={s}
              tanggal={tanggal}
              terpilih={pilihan?.kode === s.kode}
              jam={pilihan?.kode === s.kode ? pilihan.jam : null}
              onPilih={() => pilihLayanan(s)}
              onJam={pilihJam}
            />
          ))}
        </ul>
      )}
    </section>
  )

  const biayaPanel = (
    <section
      aria-labelledby="judul-biaya"
      className={`${!desktop && langkah !== 'biaya' ? 'hidden' : ''} lg:sticky lg:top-6 lg:self-start lg:rounded-[1.75rem] lg:bg-card lg:p-6 lg:shadow-[0_16px_40px_-24px_rgb(65_57_111/0.6)] lg:ring-1 lg:ring-ink-violet/10`}
    >
      <h2 ref={revealUp} id="judul-biaya" className="font-serif text-[1.5rem] leading-tight">
        {tr('Estimasi biaya')}
      </h2>
      {!layanan || !pilihan?.waktu ? (
        <p className="mt-2 text-[15px] leading-relaxed text-ink/65">
          {layanan ? tr('Pilih jam keberangkatan dulu.') : tr('Pilih layanan dan jamnya dulu, totalnya muncul di sini.')}
        </p>
      ) : (
        <Ringkasan layanan={layanan} waktu={pilihan.waktu} jumlah={jumlah} setJumlah={setJumlah} total={total} />
      )}

      <fieldset ref={revealUp} className="mt-7 min-w-0">
        <legend className="text-sm font-semibold">{tr('Metode pembayaran')}</legend>
        <ul className="mt-1">
          {GRUP_METODE.map((g) => (
            <li key={g.value}>
              <BarisMetode
                grup={g}
                on={grupMetode === g.value}
                onPilih={() => {
                  setGrupMetode(g.value)
                  setMetode(g.pilihan.length === 1 ? g.pilihan[0].value : null)
                }}
              />
              {grupMetode === g.value && g.pilihan.length > 1 && (
                <div
                  role="radiogroup"
                  aria-label={tr('Pilih {0}', { 0: g.label.toLowerCase() })}
                  className="sheet-fade flex flex-wrap gap-2 pb-3 pl-[3.75rem]"
                >
                  {g.pilihan.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={metode === p.value}
                      onClick={() => setMetode(p.value)}
                      className={`flex min-h-touch items-center gap-1 rounded-full px-4 text-sm font-semibold transition ${
                        metode === p.value
                          ? 'bg-ink-violet text-white'
                          : 'bg-card text-ink/80 ring-1 ring-ink/15 hover:bg-ink/[0.04]'
                      }`}
                    >
                      {metode === p.value && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setJenis('parkir')
                setLangkah('pilih')
              }}
              className="flex min-h-[3.5rem] w-full items-center gap-4 border-t border-ink/[0.07] py-2 text-left"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-icon-blue-deep text-white">
                <ParkirIcon size={22} aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{tr('Bayar parkir')}</span>
                <span className="block text-[13px] text-ink/60">{tr('Pesan tempat parkir per jam')}</span>
              </span>
              <ChevronRight size={18} className="text-ink/40" aria-hidden="true" />
            </button>
          </li>
        </ul>
        {!metode && <p className="mt-2 text-[13px] text-ink/55">{tr('Pilih cara bayar dulu. Kartu kredit tidak tersedia.')}</p>}
      </fieldset>

      {kirim.error && <ErrorBanner error={kirim.error} className="mt-4" />}

      <div className="mt-6 hidden lg:block">
        <PitaSimulasi />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={bayar}
            disabled={!siapBayar || kirim.jalan}
            className="bg-pill flex min-h-touch flex-1 items-center justify-center gap-2 rounded-full font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)] transition hover:brightness-110 disabled:opacity-50"
          >
            {kirim.jalan ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={18} className="fill-current" aria-hidden="true" />
            )}
            {user ? tr('Bayar sekarang') : tr('Masuk untuk bayar')}
          </button>
          <button
            type="button"
            onClick={bagi}
            className="flex min-h-touch items-center gap-2 rounded-full px-5 font-semibold text-ink-violet ring-1 ring-ink-violet/30 hover:bg-ink-violet/5"
          >
            <Share2 size={18} aria-hidden="true" /> {tr('Bagikan')}
          </button>
        </div>
        {pesan && (
          <p role="status" className="mt-2 text-center text-sm text-ink/70">
            {pesan}
          </p>
        )}
      </div>
    </section>
  )

  return (
    <PageShell title={tr('Digital Payment')} toolbar={toolbar}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pt-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10 lg:pt-8">
        {pilihPanel}
        {biayaPanel}
      </div>
      <div className="h-36 lg:hidden" aria-hidden="true" />

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 lg:hidden">
        <BottomActionBar
          actions={[
            {
              label: kirim.jalan
                ? tr('Membuka…')
                : user
                  ? `Bayar${siapBayar ? ` ${rupiah(total)}` : tr(' sekarang')}`
                  : tr('Masuk untuk bayar'),
              short: kirim.jalan ? tr('Membuka…') : tr('Bayar'),
              icon: Play,
              variant: 'pill',
              onClick: bayar,
              disabled: kirim.jalan,
            },
            { label: tr('Bagikan'), icon: Share2, variant: 'pill', onClick: bagi },
          ]}
        >
          <PitaSimulasi gelap className="-mt-1 mb-3" />
          {pesan && (
            <p role="status" className="mb-2 text-center text-sm text-white/85">
              {pesan}
            </p>
          )}
        </BottomActionBar>
      </div>
    </PageShell>
  )
}

function JenisChips({ value, onChange }) {
  const opsi = [{ value: null, label: tr('Semua') }, ...JENIS]
  return (
    <div
      role="group"
      aria-label={tr('Jenis layanan')}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {opsi.map((j) => {
        const on = value === j.value
        const Ikon = j.value ? IKON_JENIS[j.value] : null
        return (
          <button
            key={j.label}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(j.value)}
            className={`flex min-h-touch shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
              on ? 'bg-ink-violet text-white' : 'bg-card text-ink/80 ring-1 ring-ink/15 hover:bg-ink/[0.04]'
            }`}
          >
            {Ikon && <Ikon size={16} aria-hidden="true" />}
            {j.label}
          </button>
        )
      })}
    </div>
  )
}

/** Pita tanggal 14 hari ke depan (WIB). */
function PitaTanggal({ value, onChange, hariIni }) {
  const awal = new Date(`${hariIni}T12:00:00${kota.zonaWaktu.offset}`).getTime()
  const hari = Array.from({ length: JUMLAH_HARI }, (_, i) => tanggalWib(awal, i))
  return (
    <div className="mt-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CalendarDays size={16} className="text-ink-violet" aria-hidden="true" /> {tr('Tanggal')}
      </p>
      <div
        role="radiogroup"
        aria-label={tr('Tanggal')}
        className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] lg:mx-0 lg:px-0"
      >
        {hari.map((t) => {
          const { hari: h, tgl, bulan } = pecahTanggal(t)
          const on = t === value
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${t === hariIni ? tr('Hari ini, ') : ''}${h} ${tgl} ${bulan}`}
              onClick={() => onChange(t)}
              className={`fx-btn flex w-[3.75rem] shrink-0 flex-col items-center rounded-2xl py-2 ${
                on
                  ? 'bg-pill text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]'
                  : 'bg-card text-ink ring-1 ring-ink/10 hover:bg-lilac-wash/30'
              }`}
            >
              <span className={`text-[12px] font-semibold ${on ? 'text-white/85' : 'text-ink/55'}`}>
                {t === hariIni ? tr('Ini') : h}
              </span>
              <span className="font-serif text-[1.375rem] leading-tight">{tgl}</span>
              <span className={`text-[12px] ${on ? 'text-white/85' : 'text-ink/55'}`}>{bulan}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BarisLayanan({ layanan, tanggal, terpilih, jam, onPilih, onJam }) {
  const Ikon = IKON_JENIS[layanan.jenis]
  const parkir = layanan.jenis === 'parkir'
  const slot = parkir ? slotParkir(tanggal) : (layanan.slot ?? [])
  const adaSlot = slot.some((s) => s.tersedia)
  return (
    <li
      className={`border-b border-ink/[0.07] last:border-b-0 ${terpilih ? 'rounded-2xl bg-lilac-wash/25 lg:-mx-3 lg:px-3' : ''}`}
    >
      <button
        type="button"
        aria-expanded={terpilih}
        onClick={onPilih}
        className="fx-row grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 py-4 text-left lg:[--fx-inset:-0.75rem]"
      >
        <span className="grid size-11 place-items-center rounded-full bg-icon-blue text-white">
          <Ikon size={22} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-semibold">{layanan.nama}</span>
          <span className="block truncate text-[13px] text-ink/60">
            {layanan.operator ? `${layanan.operator}, ` : ''}
            {ruteLayanan(layanan)}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-serif text-[1.125rem] leading-tight text-ink-violet">{rupiah(layanan.harga)}</span>
          <span className="block text-[12px] text-ink/55">{tr('per')} {satuanLabel(layanan)}</span>
        </span>
      </button>

      {terpilih && (
        <div className="sheet-fade pb-4 pl-[3.5rem]">
          <p className="text-sm font-semibold">{parkir ? tr('Mulai parkir') : tr('Jam keberangkatan')} {tr('(WIB)')}</p>
          {adaSlot ? (
            <div
              role="radiogroup"
              aria-label={parkir ? tr('Jam mulai parkir') : tr('Jam keberangkatan')}
              className="mt-2 flex flex-wrap gap-2"
            >
              {slot
                .filter((s) => s.tersedia || !parkir)
                .map((s) => (
                  <button
                    key={s.jam}
                    type="button"
                    role="radio"
                    aria-checked={jam === s.jam}
                    disabled={!s.tersedia}
                    onClick={() => onJam(s)}
                    className={`flex min-h-touch items-center gap-1 rounded-full px-4 font-serif text-[1rem] tabular-nums transition disabled:text-ink/30 disabled:line-through ${
                      jam === s.jam ? 'bg-ink-violet text-white' : 'bg-card ring-1 ring-ink/15 hover:bg-card/70'
                    }`}
                  >
                    {jam === s.jam && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                    {s.jam.replace(':', '.')}
                  </button>
                ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink/60">{tr('Semua jadwal di tanggal ini sudah lewat. Pilih tanggal lain.')}</p>
          )}
        </div>
      )}
    </li>
  )
}

function Ringkasan({ layanan, waktu, jumlah, setJumlah, total }) {
  const satuan = satuanLabel(layanan)
  const maks = maksJumlah(layanan)
  return (
    <div className="mt-3">
      <p className="font-semibold">{layanan.nama}</p>
      <p className="text-[14px] text-ink/65">{waktuLengkap(waktu)}</p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <span className="text-sm font-semibold" id="label-jumlah">
          {layanan.jenis === 'parkir' ? tr('Lama parkir') : tr('Penumpang')}
        </span>
        <div className="flex items-center gap-1" role="group" aria-labelledby="label-jumlah">
          <button
            type="button"
            aria-label={tr('Kurangi {0}', { 0: satuan })}
            disabled={jumlah <= 1}
            onClick={() => setJumlah(jumlah - 1)}
            className="grid size-touch place-items-center rounded-full text-ink-violet ring-1 ring-ink-violet/25 disabled:opacity-35"
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <output aria-live="polite" className="w-20 text-center font-serif text-[1.375rem] tabular-nums">
            {jumlah} <span className="font-sans text-sm text-ink/60">{satuan}</span>
          </output>
          <button
            type="button"
            aria-label={tr('Tambah {0}', { 0: satuan })}
            disabled={jumlah >= maks}
            onClick={() => setJumlah(jumlah + 1)}
            className="grid size-touch place-items-center rounded-full text-ink-violet ring-1 ring-ink-violet/25 disabled:opacity-35"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-dashed border-ink-violet/25 pt-4">
        <span className="text-[14px] text-ink/65">
          {rupiah(layanan.harga)} × {jumlah} {satuan}
        </span>
        <span className="font-serif text-[2rem] leading-none text-ink-violet">{rupiah(total)}</span>
      </div>
    </div>
  )
}

function BarisMetode({ grup: metode, on, onPilih }) {
  const Ikon = IKON_METODE[metode.value]
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPilih}
      className="flex min-h-[3.5rem] w-full items-center gap-4 border-t border-ink/[0.07] py-2 text-left first:border-t-0"
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-full ${on ? 'bg-pill text-white' : 'bg-icon-blue text-white'}`}
      >
        <Ikon size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{metode.label}</span>
        <span className="block truncate text-[13px] text-ink/60">{metode.ket}</span>
      </span>
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center rounded-full ring-2 ${on ? 'bg-ink-violet text-white ring-ink-violet' : 'ring-ink/25'}`}
      >
        {on && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  )
}

function KerangkaDaftar() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true" aria-label={tr('Memuat layanan')}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="size-11 animate-pulse rounded-full bg-ink/10" />
          <span className="h-12 flex-1 animate-pulse rounded-2xl bg-ink/[0.06]" />
        </div>
      ))}
    </div>
  )
}
