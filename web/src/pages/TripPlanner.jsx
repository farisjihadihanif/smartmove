import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { CalendarClock, Navigation, Pencil, Plus, Ticket, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import PageShell from '../components/PageShell.jsx'
import TripForm from '../components/trip/TripForm.jsx'
import { IKON_MODA } from '../components/trip/ikonModa.js'
import { api } from '../lib/api.js'
import { useMediaQuery } from '../lib/useNotifications.js'
import {
  bisaDipesan,
  tautanPesan,
  hitungMundur,
  jamTrip,
  kelompokkan,
  labelModa,
  tautanNavigasi,
  teksRingkasan,
} from '../lib/trip.js'
import { hariWib } from '../lib/wib.js'
import { tr } from '../lib/i18n.js'

// Trip Planner (DESIGN §3, gaya kartu Trip Planner mockup hal. 3): rencana berikutnya di kartu
// gradasi pink → ungu, daftar rencana per hari seperti garis waktu, form asal/tujuan/moda/jam.
// Ponsel: form di lembar bawah. Desktop: form tetap di kolom kanan.

const DESKTOP = '(min-width: 64rem)'
const HALAMAN = 50

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export default function TripPlanner() {
  const desktop = useMediaQuery(DESKTOP)
  const now = useNow()
  const [data, setData] = useState({ status: 'memuat', items: [], total: 0, page: 0, error: null })
  const [form, setForm] = useState(null) // null | { trip: null | Trip, kunci }
  const [nomorBaru, setNomorBaru] = useState(0) // form desktop dikosongkan lagi setelah simpan
  const [pesan, setPesan] = useState('')
  const pesanTimer = useRef(null)

  const kabari = useCallback((teks) => {
    setPesan(teks)
    clearTimeout(pesanTimer.current)
    pesanTimer.current = setTimeout(() => setPesan(''), 3200)
  }, [])
  useEffect(() => () => clearTimeout(pesanTimer.current), [])

  const muat = useCallback(async (page = 1) => {
    setData((d) => ({ ...d, status: page === 1 ? 'memuat' : 'menambah', error: null }))
    try {
      const r = await api.get('/trips', { query: { page, limit: HALAMAN } })
      setData((d) => ({
        status: 'ok',
        items: page === 1 ? r.items : [...d.items, ...r.items.filter((t) => !d.items.some((x) => x.id === t.id))],
        total: r.total,
        page,
        error: null,
      }))
    } catch (error) {
      setData((d) => ({ ...d, status: d.items.length ? 'ok' : 'galat', error }))
    }
  }, [])
  useEffect(() => {
    setTimeout(() => muat(1), 0)
  }, [muat])

  const bukaForm = (trip = null) => setForm({ trip, kunci: `${trip?.id ?? 'baru'}-${Date.now()}` })
  const tutupForm = () => setForm(null)

  async function simpan(body) {
    const edit = form?.trip
    const { trip } = edit ? await api.patch(`/trips/${edit.id}`, body) : await api.post('/trips', body)
    setData((d) => ({
      ...d,
      items: edit ? d.items.map((t) => (t.id === trip.id ? trip : t)) : [trip, ...d.items],
      total: edit ? d.total : d.total + 1,
    }))
    tutupForm()
    setNomorBaru((n) => n + 1)
    kabari(edit ? tr('Perubahan disimpan.') : tr('Rencana disimpan.'))
  }

  async function hapus(trip) {
    try {
      await api.del(`/trips/${trip.id}`)
      setData((d) => ({ ...d, items: d.items.filter((t) => t.id !== trip.id), total: Math.max(0, d.total - 1) }))
      if (form?.trip?.id === trip.id) tutupForm()
      kabari(tr('Rencana dihapus.'))
    } catch (error) {
      kabari(error.message)
    }
  }

  const { berikutnya, grup, lewat } = kelompokkan(data.items, now)
  const kosong = data.status === 'ok' && data.items.length === 0

  // Desktop: form selalu ada di kolom kanan (rencana baru bila tidak sedang mengubah).
  const formAktif = form ?? (desktop ? { trip: null, kunci: `baru-${nomorBaru}` } : null)

  return (
    <PageShell title={tr('Trip Planner')}>
      <div className="pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10 lg:pt-10 xl:grid-cols-[minmax(0,1fr)_27rem] xl:gap-14">
        <div className="min-w-0 pb-16 lg:pb-0">
          <Sorotan trip={berikutnya} now={now} memuat={data.status === 'memuat'} onBuat={() => bukaForm()} desktop={desktop} />

          {data.status === 'galat' && <ErrorBanner className="mt-6" error={data.error} onRetry={() => muat(1)} />}

          {data.status === 'memuat' && <Kerangka />}

          {kosong && (
            <EmptyState
              icon={CalendarClock}
              title={tr('Belum ada rencana')}
              message={tr('Simpan rute yang sering kamu tempuh, misalnya rumah ke kampus, lalu mulai navigasi dengan sekali ketuk.')}
            />
          )}

          {grup.length > 0 && (
            <section aria-labelledby="judul-rencana" className="mt-8 lg:mt-10">
              <h2 id="judul-rencana" className="font-serif text-2xl">
                {tr('Rencanamu')}
              </h2>
              {grup.map((g) => (
                <section key={g.kunci} aria-label={g.judul} className="mt-5">
                  <h3 className="text-sm font-bold text-ink-violet">{g.judul}</h3>
                  <ol className="mt-2">
                    {g.items.map((t) => (
                      <ItemRencana key={t.id} trip={t} onUbah={() => bukaForm(t)} onHapus={() => hapus(t)} diubah={form?.trip?.id === t.id} />
                    ))}
                  </ol>
                </section>
              ))}
            </section>
          )}

          {lewat.length > 0 && (
            <details className="group mt-8 rounded-[1.5rem] bg-surface-nav/70 px-4 py-1 lg:px-5">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between text-[15px] font-semibold text-ink/75 [&::-webkit-details-marker]:hidden">
                {tr('Sudah lewat (')}{lewat.length})
                <span className="text-sm font-normal text-ink-violet group-open:hidden">{tr('Tampilkan')}</span>
                <span className="hidden text-sm font-normal text-ink-violet group-open:inline">{tr('Sembunyikan')}</span>
              </summary>
              <ol className="pb-2 opacity-80">
                {lewat.map((t) => (
                  <ItemRencana key={t.id} trip={t} lewat now={now} onUbah={() => bukaForm(t)} onHapus={() => hapus(t)} diubah={form?.trip?.id === t.id} />
                ))}
              </ol>
            </details>
          )}

          {data.items.length < data.total && data.status !== 'memuat' && (
            <button
              type="button"
              onClick={() => muat(data.page + 1)}
              disabled={data.status === 'menambah'}
              className="mx-auto mt-6 flex min-h-touch items-center rounded-full px-6 text-[15px] font-semibold text-ink-violet ring-1 ring-ink-violet/25 hover:bg-ink-violet/[0.05] disabled:opacity-60"
            >
              {data.status === 'menambah' ? tr('Memuat…') : tr('Muat rencana lainnya')}
            </button>
          )}
          {data.status === 'ok' && data.error && <ErrorBanner className="mt-4" error={data.error} onRetry={() => muat(data.page + 1)} />}
        </div>

        {desktop ? (
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-[1.75rem] bg-card p-6 shadow-[0_18px_40px_-22px_rgb(65_57_111/0.55)] ring-1 ring-ink/[0.07]">
              <PanelForm aktif={formAktif} onSimpan={simpan} onBatal={form ? tutupForm : null} />
            </div>
          </aside>
        ) : (
          formAktif && (
            <LembarForm onTutup={tutupForm}>
              <PanelForm aktif={formAktif} onSimpan={simpan} onBatal={tutupForm} />
            </LembarForm>
          )
        )}
      </div>

      {!desktop && !formAktif && data.status !== 'memuat' && (berikutnya || data.items.length > 0) && (
        <button
          type="button"
          onClick={() => bukaForm()}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex min-h-touch items-center gap-2 rounded-full bg-login-button py-3 pl-4 pr-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-8px_rgb(115_36_169/0.8)]"
        >
          <Plus size={20} aria-hidden="true" />
          {tr('Buat rencana')}
        </button>
      )}

      {pesan && (
        <p
          role="status"
          className="sheet-fade fixed left-1/2 top-6 z-[60] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-ink-violet px-4 py-2.5 text-center text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgb(65_57_111/0.8)]"
        >
          {pesan}
        </p>
      )}
    </PageShell>
  )
}

function PanelForm({ aktif, onSimpan, onBatal }) {
  const id = useId()
  const edit = Boolean(aktif.trip)
  return (
    <>
      <h2 id={id} className="font-serif text-2xl">
        {edit ? tr('Ubah rencana') : tr('Rencana baru')}
      </h2>
      <p className="mb-5 mt-1 text-sm text-ink/65">
        {edit ? tr('Perubahan langsung dipakai saat kamu mulai navigasi.') : tr('Pilih asal, tujuan, dan cara berangkat.')}
      </p>
      <TripForm key={aktif.kunci} awal={aktif.trip} onSimpan={onSimpan} onBatal={onBatal} idJudul={id} />
    </>
  )
}

/** Lembar bawah (ponsel) berisi form. */
function LembarForm({ onTutup, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onTutup()
    document.addEventListener('keydown', esc)
    const lama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = lama
    }
  }, [onTutup])
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={tr('Form rencana perjalanan')}>
      <button type="button" aria-label={tr('Tutup form')} onClick={onTutup} className="sheet-fade absolute inset-0 bg-ink-violet/45" />
      <section className="sheet-rise relative max-h-[92dvh] overflow-y-auto rounded-t-[1.75rem] bg-surface px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_-14px_rgb(65_57_111/0.55)]">
        <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-ink/15" />
        <button
          type="button"
          onClick={onTutup}
          aria-label={tr('Tutup')}
          className="absolute right-3 top-3 grid size-touch place-items-center rounded-full text-ink/60 hover:bg-black/5"
        >
          <X size={20} aria-hidden="true" />
        </button>
        {children}
      </section>
    </div>
  )
}

/** Kartu gradasi Trip Planner (mockup hal. 3): rencana terdekat, atau ajakan membuat rencana. */
function Sorotan({ trip, now, memuat, onBuat, desktop }) {
  const kartu =
    'bg-trip-card grain relative overflow-hidden rounded-[1.75rem] text-white shadow-[0_14px_30px_-16px_rgb(95_63_115/0.9)]'
  const bayang = 'drop-shadow-[0_1px_2px_rgb(65_57_111/0.35)]'

  if (memuat) return <div className={`${kartu} h-56 animate-pulse lg:h-64`} aria-hidden="true" />

  if (!trip) {
    return (
      <section className={`${kartu} px-5 py-6 lg:px-8 lg:py-8`}>
        <h2 className={`font-serif text-[1.75rem] leading-tight lg:text-4xl ${bayang}`}>{tr('Mau ke mana berikutnya?')}</h2>
        <p className={`mt-2 max-w-[34ch] font-serif text-[15px] leading-snug text-white/95 lg:text-lg ${bayang}`}>
          {tr('Buat perencanaan terbaik untuk setiap perjalananmu.')}
        </p>
        {!desktop && (
          <button
            type="button"
            onClick={onBuat}
            className="mt-5 flex min-h-touch items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-trip-4 shadow-[0_6px_16px_-8px_rgb(65_57_111/0.8)]"
          >
            <Plus size={20} aria-hidden="true" />
            {tr('Buat rencana')}
          </button>
        )}
      </section>
    )
  }

  const ringkas = teksRingkasan(trip.ringkasan, trip.moda)
  const Ikon = IKON_MODA[trip.moda]
  return (
    <section aria-labelledby="judul-berikutnya" className={`${kartu} px-5 pb-5 pt-5 lg:px-8 lg:pb-7 lg:pt-7`}>
      <h2 id="judul-berikutnya" className="sr-only">
        {tr('Perjalanan berikutnya')}
      </h2>
      <div className="flex items-start justify-between gap-4">
        <div className={bayang}>
          <p className="font-serif text-[15px] text-white/90 lg:text-lg">
            {hariWib(trip.berangkatPada, now)}
            {trip.judul ? `, ${trip.judul}` : ''}
          </p>
          <p className="font-serif text-[3.5rem] leading-none tracking-tight lg:text-[5rem]">{jamTrip(trip)}</p>
          <p className="mt-2 text-sm font-semibold text-white/95">{hitungMundur(trip.berangkatPada, now)}</p>
        </div>
        <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold">
          <Ikon size={16} aria-hidden="true" />
          {labelModa(trip.moda)}
        </span>
      </div>

      <Lintasan trip={trip} terang className="mt-5" />

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <TombolNavigasi trip={trip} terang />
        {bisaDipesan(trip) && <TombolPesan trip={trip} terang />}
        {ringkas && <span className={`text-sm font-semibold text-white/95 ${bayang}`}>{tr('Estimasi')} {ringkas}</span>}
      </div>
    </section>
  )
}

/** Asal (lingkaran) ke tujuan (titik penuh), dihubungkan garis seperti rute di peta. */
function Lintasan({ trip, terang = false, className = '' }) {
  const garis = terang ? 'border-white/60' : 'border-ink-violet/35'
  return (
    <ol className={`relative ${className}`} aria-label={tr("Dari {0} ke {1}", { 0: trip.asal.nama, 1: trip.tujuan.nama })}>
      <span aria-hidden="true" className={`absolute bottom-[0.8rem] left-[0.3rem] top-[0.8rem] border-l-2 border-dotted ${garis}`} />
      <li className="relative flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`size-3 shrink-0 rounded-full border-[2.5px] ${terang ? 'border-white bg-trip-2' : 'border-ink-violet bg-white'}`}
        />
        <span className={`min-w-0 truncate text-[15px] ${terang ? 'text-white/90' : 'text-ink/70'}`}>{trip.asal.nama}</span>
      </li>
      <li className="relative mt-2 flex items-center gap-3">
        <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${terang ? 'bg-white ring-4 ring-white/25' : 'bg-pill-via ring-4 ring-pill-via/15'}`} />
        <span className={`min-w-0 truncate text-[17px] font-semibold ${terang ? 'text-white' : 'text-ink'}`}>{trip.tujuan.nama}</span>
      </li>
    </ol>
  )
}

function TombolNavigasi({ trip, terang = false }) {
  return (
    <Link
      to={tautanNavigasi(trip)}
      className={
        terang
          ? 'flex min-h-touch items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-trip-4 shadow-[0_6px_16px_-8px_rgb(65_57_111/0.8)] transition hover:bg-white/90'
          : 'flex min-h-touch items-center gap-2 whitespace-nowrap rounded-full bg-pill px-4 text-sm font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.7)] transition hover:brightness-110'
      }
    >
      <Navigation size={terang ? 18 : 16} aria-hidden="true" />
      {tr('Mulai navigasi')}
    </Link>
  )
}

/** Pesan tiket (umum) / parkir (mobil, motor) di Digital Payment. */
function TombolPesan({ trip, terang = false }) {
  const label = trip.moda === 'transit' ? tr('Pesan tiket') : tr('Pesan parkir')
  return (
    <Link
      to={tautanPesan(trip)}
      aria-label={terang ? undefined : `${label} ke ${trip.tujuan.nama}`}
      className={
        terang
          ? 'flex min-h-touch items-center gap-2 rounded-full bg-white/20 px-4 text-[15px] font-semibold text-white ring-1 ring-white/50 transition hover:bg-white/30'
          : 'flex min-h-touch items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold text-ink-violet ring-1 ring-ink-violet/25 transition hover:bg-ink-violet/[0.06]'
      }
    >
      <Ticket size={terang ? 18 : 16} aria-hidden="true" />
      {label}
    </Link>
  )
}

function ItemRencana({ trip, onUbah, onHapus, diubah, lewat = false, now }) {
  const [konfirmasi, setKonfirmasi] = useState(false)
  const jam = jamTrip(trip)
  const ringkas = teksRingkasan(trip.ringkasan, trip.moda)
  const Ikon = IKON_MODA[trip.moda]
  return (
    <li
      className={`relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 border-b border-ink/[0.07] py-4 last:border-b-0 lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-x-5 ${
        diubah ? 'rounded-2xl bg-lilac-wash/25 px-2 lg:-mx-3 lg:px-3' : ''
      }`}
    >
      <div className="pt-0.5">
        {jam ? (
          <>
            <p className="font-serif text-[1.375rem] leading-none text-ink lg:text-[1.75rem]">{jam}</p>
            {lewat && <p className="mt-1 text-xs text-ink/55">{hariWib(trip.berangkatPada, now)}</p>}
          </>
        ) : (
          <p className="pt-1 text-xs font-semibold leading-tight text-ink/50">{tr('Tanpa jam')}</p>
        )}
      </div>

      <div className="min-w-0">
        {trip.judul && <p className="mb-1.5 text-[13px] font-bold text-trip-4">{trip.judul}</p>}
        <Lintasan trip={trip} />
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink/65">
          <span className="flex items-center gap-1.5 font-semibold text-ink-violet">
            <Ikon size={16} aria-hidden="true" />
            {labelModa(trip.moda)}
          </span>
          {ringkas && <span>{ringkas}</span>}
        </p>

        {konfirmasi ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-login-field px-3 py-1.5" role="alert">
            <span className="flex-1 text-sm">{tr('Hapus rencana ini?')}</span>
            <button type="button" onClick={() => setKonfirmasi(false)} className="min-h-touch rounded-full px-3 text-sm font-semibold text-ink/70 hover:bg-black/5">
              {tr('Batal')}
            </button>
            <button
              type="button"
              onClick={onHapus}
              className="min-h-touch rounded-full bg-traffic-macet px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              {tr('Hapus')}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1">
            <TombolNavigasi trip={trip} />
            {!lewat && bisaDipesan(trip) && <TombolPesan trip={trip} />}
            <span className="flex-1" />
            <button
              type="button"
              onClick={onUbah}
              aria-label={tr("Ubah rencana ke {0}", { 0: trip.tujuan.nama })}
              className="grid size-touch place-items-center rounded-full text-ink-violet hover:bg-ink-violet/[0.07]"
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setKonfirmasi(true)}
              aria-label={tr("Hapus rencana ke {0}", { 0: trip.tujuan.nama })}
              className="grid size-touch place-items-center rounded-full text-ink/55 hover:bg-traffic-macet/10 hover:text-[#C62828]"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

function Kerangka() {
  return (
    <div className="mt-8 space-y-4" aria-busy="true" aria-label={tr('Memuat rencana')}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid grid-cols-[3.5rem_1fr] gap-3">
          <span className="h-6 animate-pulse rounded-lg bg-ink/10" />
          <span className="h-24 animate-pulse rounded-2xl bg-ink/[0.06]" />
        </div>
      ))}
    </div>
  )
}
