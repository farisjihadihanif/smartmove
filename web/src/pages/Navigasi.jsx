import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MapPin, Play, Route, Share2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import BottomActionBar from '../components/BottomActionBar.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import MapView from '../components/MapView.jsx'
import PageShell from '../components/PageShell.jsx'
import PillToggle from '../components/PillToggle.jsx'
import SearchField from '../components/SearchField.jsx'
import NavLayers from '../components/nav/NavLayers.jsx'
import RouteSheet from '../components/nav/RouteSheet.jsx'
import { api, latLng } from '../lib/api.js'
import { MEDAN_CENTER } from '../lib/geo.js'
import { MODA, formatJarak, teksBagikan, titikFoto } from '../lib/navigasi.js'

// Smart Navigation (mockup hal. 4, PRD §6.1): cari tujuan, pilih moda, rute di peta,
// ringkasan & langkah di lembar bawah (desktop: panel samping kiri), Play (panduan langkah), Share, Street view (Mapillary).
// Lokasi pengguna hanya dipakai selama layar terbuka, tidak disimpan (aturan bisnis #5).
// URL: ?q= (dari Beranda), ?dari=lat,lng&ke=lat,lng&mode=&dariNama=&keNama= (dari Trip Planner).

const LAPISAN = [
  { value: 'traffic', label: 'Traffic' },
  { value: 'transit', label: 'Transportasi umum' },
  { value: 'street', label: 'Street view' },
]
const SEGERA = {
  traffic: 'Lapisan Traffic hadir bersama Live Traffic Information.',
  transit: 'Rute transportasi umum sedang disiapkan.',
}
const MEBIDANG = { minLat: 3.25, maxLat: 3.9, minLng: 98.35, maxLng: 99.0 }
const dalamWilayah = ({ lat, lng }) =>
  lat >= MEBIDANG.minLat && lat <= MEBIDANG.maxLat && lng >= MEBIDANG.minLng && lng <= MEBIDANG.maxLng

function parseTitik(v) {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(v || '')
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null
}

/** Nama titik dari API (reverse); bila gagal cukup "Titik di peta". `nama` dari URL dipakai langsung. */
async function namaTitik(lokasi, nama) {
  if (nama?.trim()) return { nama: nama.trim().slice(0, 200), alamat: '', lokasi }
  try {
    const { tempat } = await api.get('/places/reverse', { query: { at: latLng(lokasi) } })
    return { nama: tempat.nama, alamat: tempat.alamat, lokasi }
  } catch {
    return { nama: 'Titik di peta', alamat: '', lokasi }
  }
}

export default function Navigasi() {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [hasil, setHasil] = useState(null) // { status, items, error }
  const [dari, setDari] = useState(null)
  const [ke, setKe] = useState(null)
  const [lokasiStatus, setLokasiStatus] = useState('mencari')
  const [target, setTarget] = useState('ke')
  const [mode, setMode] = useState(() => (MODA.some((m) => m.value === params.get('mode')) ? params.get('mode') : 'driving'))
  const [ruteState, setRuteState] = useState({ kunci: null, rute: null, galat: null })
  const [coba, setCoba] = useState(0)
  const [buka, setBuka] = useState(false)
  const [play, setPlay] = useState(null)
  const [fitKey, setFitKey] = useState(0)
  const [lapisan, setLapisan] = useState([])
  const [fotoState, setFotoState] = useState({ kunci: null, data: null, error: null })
  const [tengah, setTengah] = useState({ lat: MEDAN_CENTER[0], lng: MEDAN_CENTER[1] })
  const [pesan, setPesan] = useState('')
  const pesanTimer = useRef(null)

  const kabari = useCallback((teks) => {
    setPesan(teks)
    clearTimeout(pesanTimer.current)
    pesanTimer.current = setTimeout(() => setPesan(''), 3200)
  }, [])
  useEffect(() => () => clearTimeout(pesanTimer.current), [])

  // Titik dari URL (Trip Planner) atau lokasi perangkat untuk asal.
  useEffect(() => {
    let batal = false
    const pDari = parseTitik(params.get('dari'))
    const pKe = parseTitik(params.get('ke'))
    if (pKe && dalamWilayah(pKe)) {
      namaTitik(pKe, params.get('keNama')).then((t) => {
        if (batal) return
        setKe(t)
        setQuery((q) => q || t.nama)
      })
    }
    if (pDari && dalamWilayah(pDari)) {
      namaTitik(pDari, params.get('dariNama')).then((t) => {
        if (batal) return
        setDari(t)
        setLokasiStatus('tidak')
      })
    } else if (!('geolocation' in navigator)) {
      setTimeout(() => setLokasiStatus('tidak'), 0)
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (batal) return
          const lokasi = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          if (!dalamWilayah(lokasi)) return setLokasiStatus('luar')
          setLokasiStatus('ok')
          setDari((d) => d ?? { nama: 'Lokasi kamu', alamat: '', lokasi, saya: true })
        },
        () => !batal && setLokasiStatus('ditolak'),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      )
    }
    return () => {
      batal = true
    }
    // Hanya saat layar dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pencarian tempat (dari kolom atau ?q=).
  const cari = useCallback(
    async (q) => {
      const s = q.trim()
      if (s.length < 2) return setHasil({ status: 'galat', items: [], error: { message: 'Ketik minimal 2 huruf.' } })
      setHasil({ status: 'memuat', items: [] })
      try {
        const near = dari?.lokasi ?? tengah
        const { items } = await api.get('/places/search', { query: { q: s, near: latLng(near) } })
        setHasil({ status: 'ok', items })
      } catch (error) {
        setHasil({ status: 'galat', items: [], error })
      }
    },
    [dari, tengah],
  )
  const cariAwal = useRef(params.get('q'))
  useEffect(() => {
    if (!cariAwal.current) return
    const q = cariAwal.current
    cariAwal.current = null
    setTimeout(() => cari(q), 0)
  }, [cari])

  const pilih = useCallback(
    (tempat) => {
      setHasil(null)
      setPlay(null)
      if (target === 'dari') {
        setDari(tempat)
        setTarget('ke')
      } else {
        setKe(tempat)
        setQuery(tempat.nama)
      }
    },
    [target],
  )

  const ketukPeta = useCallback(
    async (lokasi) => {
      if (!dalamWilayah(lokasi)) return kabari('SmartMove baru melayani Medan dan sekitarnya.')
      setHasil(null)
      pilih(await namaTitik(lokasi))
    },
    [pilih, kabari],
  )

  // Hitung rute setiap asal, tujuan, atau moda berubah.
  const kunciRute = dari && ke ? `${latLng(dari.lokasi)};${latLng(ke.lokasi)};${mode};${coba}` : null
  useEffect(() => {
    if (!kunciRute) return
    const ctrl = new AbortController()
    api
      .get('/routes', { query: { from: latLng(dari.lokasi), to: latLng(ke.lokasi), mode }, signal: ctrl.signal })
      .then(
        (rute) => setRuteState({ kunci: kunciRute, rute, galat: null }),
        (galat) => galat.name !== 'AbortError' && setRuteState({ kunci: kunciRute, rute: null, galat }),
      )
    return () => ctrl.abort()
    // dari/ke/mode sudah terwakili kunciRute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciRute])
  const siap = ruteState.kunci === kunciRute
  const rute = siap ? ruteState.rute : null
  const galatRute = siap ? ruteState.galat : null
  const memuatRute = Boolean(kunciRute) && !siap
  const langkahAktif = play !== null && rute ? rute.langkah[play] : null

  // Street view: foto jalan di titik langkah aktif / tujuan / tengah peta.
  const streetAktif = lapisan.includes('street')
  const titik = streetAktif ? titikFoto({ langkah: langkahAktif, ke, tengah: ke ? null : tengah }) : null
  const kunciFoto = titik ? `${titik.lat.toFixed(4)},${titik.lng.toFixed(4)}` : null
  useEffect(() => {
    if (!kunciFoto) return
    const ctrl = new AbortController()
    api.get('/streetview', { query: { at: kunciFoto }, signal: ctrl.signal }).then(
      ({ foto }) => setFotoState({ kunci: kunciFoto, data: foto, error: null }),
      (error) => error.name !== 'AbortError' && setFotoState({ kunci: kunciFoto, data: null, error }),
    )
    return () => ctrl.abort()
  }, [kunciFoto])
  const foto = useMemo(() => {
    if (!streetAktif) return { status: 'mati' }
    if (fotoState.kunci !== kunciFoto) return { status: 'memuat' }
    if (fotoState.error) return { status: 'galat', error: fotoState.error }
    if (!fotoState.data) return { status: 'kosong' }
    return { status: 'ada', data: fotoState.data, nama: langkahAktif ? null : ke?.nama }
  }, [streetAktif, fotoState, kunciFoto, langkahAktif, ke])

  function ubahLapisan(next) {
    const baru = next.find((v) => !lapisan.includes(v))
    if (SEGERA[baru]) return kabari(SEGERA[baru])
    setLapisan(next.filter((v) => !SEGERA[v]))
  }

  async function bagikan() {
    if (!rute || !dari || !ke) return
    const teks = teksBagikan({ dari, ke, mode, rute })
    try {
      if (navigator.share) {
        await navigator.share({ title: `Rute ke ${ke.nama}`, text: teks })
        return
      }
      await navigator.clipboard.writeText(teks)
      kabari('Tautan rute disalin. Tempel di chat untuk membagikannya.')
    } catch (e) {
      if (e?.name !== 'AbortError') kabari('Rute belum bisa dibagikan dari peramban ini.')
    }
  }

  const adaRute = Boolean(rute)
  const aksi = [
    {
      label: 'Rute',
      icon: Route,
      disabled: !adaRute,
      onClick: () => {
        setPlay(null)
        setBuka(true)
        setFitKey((n) => n + 1)
      },
    },
    { label: 'Play', icon: Play, disabled: !adaRute, onClick: () => setPlay(0) },
    { label: 'Share', icon: Share2, disabled: !adaRute, onClick: bagikan },
  ]
  return (
    <PageShell
      map
      title="Smart Navigation"
      toolbar={
        <>
          <div className="relative lg:max-w-md lg:flex-1">
            <SearchField
              value={query}
              onChange={(v) => {
                setQuery(v)
                if (!v) setHasil(null)
              }}
              onSubmit={cari}
              placeholder={target === 'dari' ? 'Cari titik asal' : 'Telusuri di sini'}
              label={target === 'dari' ? 'Cari titik asal' : 'Cari tujuan'}
            />
            {hasil && <HasilCari hasil={hasil} onPilih={pilih} onTutup={() => setHasil(null)} />}
          </div>
          <PillToggle options={LAPISAN} value={lapisan} onChange={ubahLapisan} multiple label="Lapisan peta" fitDesktop className="lg:shrink-0" />
        </>
      }
    >
      {/* Ponsel: peta + lembar bawah + bar aksi. Desktop: panel rute di kiri, peta memenuhi sisanya. */}
      <div className="relative z-0 flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <MapView tucked attribution="topright" className="flex-1 lg:mb-0" label="Peta rute">
            <NavLayers
              dari={dari}
              ke={ke}
              rute={rute}
              langkahAktif={langkahAktif}
              fitKey={fitKey}
              onPick={ketukPeta}
              onMove={setTengah}
            />
          </MapView>

          {pesan && (
            <p
              role="status"
              className="sheet-fade absolute left-1/2 top-12 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-ink-violet px-4 py-2.5 text-center text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgb(65_57_111/0.8)]"
            >
              {pesan}
            </p>
          )}
        </div>

        <section
          aria-label="Rute"
          className="sheet-rise absolute inset-x-0 -bottom-7 z-10 max-h-[58%] overflow-y-auto rounded-t-[1.75rem] bg-surface px-5 pb-[calc(1.75rem+1rem)] pt-2 shadow-[0_-12px_32px_-14px_rgb(65_57_111/0.55)] lg:static lg:order-first lg:-mt-7 lg:flex lg:max-h-none lg:w-[26rem] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:rounded-none lg:p-0 lg:shadow-[10px_0_28px_-18px_rgb(65_57_111/0.55)] xl:w-[28rem]"
        >
          <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-ink/15 lg:hidden" />
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-6 lg:pb-6 lg:pt-12">
            <RouteSheet
              dari={dari}
              ke={ke}
              lokasiStatus={lokasiStatus}
              target={target}
              onTarget={(t) => {
                setTarget(t)
                setHasil(null)
                setQuery(t === 'ke' ? (ke?.nama ?? '') : '')
              }}
              mode={mode}
              onMode={setMode}
              rute={rute}
              memuat={memuatRute}
              galat={galatRute}
              onRetry={() => setCoba((n) => n + 1)}
              buka={buka}
              onBuka={setBuka}
              play={play}
              onPlay={setPlay}
              foto={foto}
              onTutupFoto={() => setLapisan((l) => l.filter((v) => v !== 'street'))}
            />
          </div>
          <BottomActionBar actions={aksi} className="hidden lg:block lg:rounded-t-[1.75rem]" />
        </section>
      </div>

      <BottomActionBar actions={aksi} className="lg:hidden" />
    </PageShell>
  )
}

function HasilCari({ hasil, onPilih, onTutup }) {
  return (
    <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(22rem,55dvh)] overflow-y-auto rounded-3xl bg-surface p-2 shadow-[0_18px_40px_-14px_rgb(65_57_111/0.6)] ring-1 ring-ink/[0.06]">
      {hasil.status === 'memuat' && (
        <p className="flex items-center gap-2 px-3 py-3 text-sm text-ink/70">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Mencari tempat…
        </p>
      )}
      {hasil.status === 'galat' && <ErrorBanner error={hasil.error} onDismiss={onTutup} />}
      {hasil.status === 'ok' && hasil.items.length === 0 && (
        <p className="px-3 py-3 text-sm text-ink/70">Tempat tidak ditemukan di Medan dan sekitarnya. Coba nama lain atau ketuk peta.</p>
      )}
      {hasil.status === 'ok' && hasil.items.length > 0 && (
        <ul aria-label="Hasil pencarian">
          {hasil.items.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPilih(t)}
                className="flex min-h-touch w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-ink/[0.04]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:rgb(218_184_246/0.45)] text-ink-violet">
                  <MapPin size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{t.nama}</span>
                  {t.alamat && <span className="block truncate text-xs text-ink/60">{t.alamat}</span>}
                </span>
                {t.jarakM !== undefined && <span className="shrink-0 text-xs tabular-nums text-ink/55">{formatJarak(t.jarakM)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
