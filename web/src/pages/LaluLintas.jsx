import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Megaphone, Route, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomActionBar from '../components/BottomActionBar.jsx'
import HasilCari from '../components/HasilCari.jsx'
import MapView from '../components/MapView.jsx'
import PageShell from '../components/PageShell.jsx'
import PillToggle from '../components/PillToggle.jsx'
import SearchField from '../components/SearchField.jsx'
import TrafficLegend from '../components/TrafficLegend.jsx'
import TrafficLayers from '../components/traffic/TrafficLayers.jsx'
import { DaftarKoridor, DetailLaporan, FormLaporan } from '../components/traffic/TrafficPanel.jsx'
import { api, latLng } from '../lib/api.js'
import { PUSAT_KOTA, dalamWilayah } from '../lib/geo.js'
import { PESAN_DIGABUNG, PESAN_TERKIRIM, teksBagikanLaluLintas } from '../lib/lalulintas.js'
import { useAuth } from '../lib/useAuth.js'
import { useLaluLintas } from '../lib/useLaluLintas.js'
import { tr } from '../lib/i18n.js'

// Live Traffic Information (mockup hal. 6, PRD §6.2, T-205).
// Tab Estimasi Waktu: waktu tempuh jalan utama + kotak "12 mnt / 4,9 km" di peta.
// Tab Peta Interaktif: laporan warga di area peta + legenda. Laporkan = POST /traffic/reports (wajib masuk).
// Lokasi perangkat hanya diminta saat melapor dan tidak disimpan (aturan bisnis #5).

const TAB = [
  { value: 'estimasi', label: tr('Estimasi Waktu') },
  { value: 'peta', label: tr('Peta Interaktif') },
]
const keLatLng = ([lng, lat]) => [lat, lng]

// Pusat kota tampil di area peta yang tidak tertutup lembar bawah (ponsel: geser ±2,4 km ke selatan).
const pusatAwal = () =>
  window.matchMedia('(min-width: 64rem)').matches ? PUSAT_KOTA : [PUSAT_KOTA[0] - 0.022, PUSAT_KOTA[1]]

function paddingPeta() {
  return window.matchMedia('(min-width: 64rem)').matches
    ? { paddingTopLeft: [60, 90], paddingBottomRight: [60, 60] }
    : { paddingTopLeft: [24, 80], paddingBottomRight: [24, Math.round(window.innerHeight * 0.38)] }
}

export default function LaluLintas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { koridor, laporan, onArea, muatUlang, terimaLaporan } = useLaluLintas()
  const [tab, setTab] = useState('estimasi')
  const [pilih, setPilih] = useState(null)
  const [aktif, setAktif] = useState(null)
  const [query, setQuery] = useState('')
  const [hasil, setHasil] = useState(null)
  const [fokusTitik, setFokusTitik] = useState(null)
  const [lapor, setLapor] = useState(null) // { titik, nama }
  const [konfirmasi, setKonfirmasi] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [pusat] = useState(pusatAwal)
  const tengah = useRef({ lat: PUSAT_KOTA[0], lng: PUSAT_KOTA[1] })
  const [pesan, setPesan] = useState('')
  const pesanTimer = useRef(null)

  const kabari = useCallback((teks) => {
    setPesan(teks)
    clearTimeout(pesanTimer.current)
    pesanTimer.current = setTimeout(() => setPesan(''), 3600)
  }, [])
  useEffect(() => () => clearTimeout(pesanTimer.current), [])

  const area = useCallback(
    (b) => {
      // Titik awal laporan = tengah area yang terlihat (di ponsel bagian bawah peta tertutup lembar).
      const c = b.getCenter()
      const ponsel = !window.matchMedia('(min-width: 64rem)').matches
      tengah.current = { lat: ponsel ? c.lat + (b.getNorth() - c.lat) * 0.35 : c.lat, lng: c.lng }
      onArea(b)
    },
    [onArea],
  )

  const fokusGaris = useMemo(() => {
    const k = koridor.items.find((x) => x.kode === pilih)
    return k ? k.garis.map(keLatLng) : null
    // Sengaja tidak bergantung pada koridor.items: penyegaran 2 menit tidak boleh menggeser peta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilih])

  async function namai(titik) {
    try {
      const { tempat } = await api.get('/places/reverse', { query: { at: latLng(titik) } })
      return tempat.nama
    } catch {
      return tr('Titik di peta')
    }
  }

  async function aturTitik(titik, nama) {
    if (!dalamWilayah(titik)) return kabari(tr('SmartMove baru melayani Medan dan sekitarnya.'))
    setLapor({ titik, nama: nama ?? '' })
    if (!nama) {
      const n = await namai(titik)
      setLapor((l) => (l && l.titik === titik ? { ...l, nama: n } : l))
    }
  }

  function lokasiSaya() {
    if (!('geolocation' in navigator)) return kabari(tr('Peramban ini tidak bisa membaca lokasi. Ketuk peta untuk memilih titik.'))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const titik = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (!dalamWilayah(titik)) return kabari(tr('Lokasimu di luar Medan. Ketuk peta untuk memilih titik.'))
        aturTitik(titik)
        setFokusTitik([titik.lat, titik.lng])
      },
      () => kabari(tr('Izin lokasi ditolak. Ketuk peta untuk memilih titik.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function mulaiLapor() {
    if (!user) return navigate('/masuk', { state: { from: '/lalu-lintas' } })
    setHasil(null)
    setAktif(null)
    aturTitik({ ...tengah.current })
  }

  async function kirimLaporan(isi) {
    const { laporan: l, digabung } = await api.post('/traffic/reports', { lokasi: lapor.titik, ...isi })
    terimaLaporan(l)
    setLapor(null)
    setTab('peta')
    setNow(Date.now())
    kabari(digabung ? PESAN_DIGABUNG : PESAN_TERKIRIM)
  }

  async function konfirmasiLaporan() {
    if (!user) return navigate('/masuk', { state: { from: '/lalu-lintas' } })
    setKonfirmasi(true)
    try {
      const { laporan: l, digabung } = await api.post('/traffic/reports', {
        lokasi: aktif.lokasi,
        tingkat: aktif.tingkat,
        kejadian: aktif.kejadian,
      })
      terimaLaporan(l)
      setAktif(l)
      kabari(digabung ? PESAN_DIGABUNG : PESAN_TERKIRIM)
    } catch (e) {
      kabari(e.message)
    } finally {
      setKonfirmasi(false)
    }
  }

  const cari = useCallback(async (q) => {
    const s = q.trim()
    if (s.length < 2) return setHasil({ status: 'galat', items: [], error: { message: tr('Ketik minimal 2 huruf.') } })
    setHasil({ status: 'memuat', items: [] })
    try {
      const { items } = await api.get('/places/search', { query: { q: s, near: latLng(tengah.current) } })
      setHasil({ status: 'ok', items })
    } catch (error) {
      setHasil({ status: 'galat', items: [], error })
    }
  }, [])

  function pilihTempat(t) {
    setHasil(null)
    setQuery(t.nama)
    setFokusTitik([t.lokasi.lat, t.lokasi.lng])
    if (lapor) aturTitik(t.lokasi, t.nama)
  }

  function ketukPeta(titik) {
    if (lapor) return aturTitik(titik)
    setAktif(null)
  }

  async function bagikan() {
    if (!koridor.items.length) return
    const teks = teksBagikanLaluLintas(koridor.items)
    try {
      if (navigator.share) return await navigator.share({ title: tr('Lalu lintas Medan'), text: teks })
      await navigator.clipboard.writeText(teks)
      kabari(tr('Ringkasan lalu lintas disalin. Tempel di chat untuk membagikannya.'))
    } catch (e) {
      if (e?.name !== 'AbortError') kabari(tr('Belum bisa dibagikan dari peramban ini.'))
    }
  }

  const aksi = [
    { label: tr('Rute'), icon: Route, onClick: () => navigate('/navigasi') },
    { label: tr('Laporkan'), short: tr('Lapor'), icon: Megaphone, onClick: mulaiLapor, disabled: Boolean(lapor) },
    { label: tr('Share'), icon: Share2, onClick: bagikan, disabled: !koridor.items.length },
  ]
  const estimasi = tab === 'estimasi'

  return (
    <PageShell
      map
      title={tr('Live Traffic Information')}
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
              placeholder={tr('Telusuri di sini')}
              label={tr('Cari tempat di peta')}
            />
            {hasil && <HasilCari hasil={hasil} onPilih={pilihTempat} onTutup={() => setHasil(null)} />}
          </div>
          <PillToggle
            options={TAB}
            value={tab}
            onChange={(v) => {
              setTab(v)
              setAktif(null)
            }}
            label={tr('Tampilan')}
            fitDesktop
            className="lg:shrink-0"
          />
        </>
      }
    >
      <div className="relative z-0 flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <MapView tucked center={pusat} zoom={13} attribution="topright" className="flex-1 lg:mb-0" label={tr('Peta lalu lintas')}>
            <TrafficLayers
              koridor={koridor.items}
              laporan={estimasi && !lapor ? [] : laporan}
              kotak={estimasi && !lapor}
              pilihKoridor={estimasi ? pilih : null}
              onPilihKoridor={estimasi && !lapor ? (k) => setPilih((p) => (p === k ? null : k)) : undefined}
              laporanAktif={aktif}
              onPilihLaporan={lapor ? undefined : (r) => {
                setNow(Date.now())
                setAktif(r)
              }}
              onPick={ketukPeta}
              onArea={area}
              titikLapor={lapor?.titik}
              fokusGaris={estimasi ? fokusGaris : null}
              fokusTitik={fokusTitik}
              padding={paddingPeta()}
              redup={Boolean(lapor)}
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
          aria-label={lapor ? tr('Laporkan kondisi jalan') : estimasi ? tr('Estimasi waktu') : tr('Peta interaktif')}
          className={`sheet-rise absolute inset-x-0 -bottom-7 z-10 overflow-y-auto rounded-t-[1.75rem] bg-surface px-5 pb-[calc(1.75rem+1rem)] pt-2 shadow-[0_-12px_32px_-14px_rgb(65_57_111/0.55)] lg:static lg:order-first lg:-mt-7 lg:flex lg:max-h-none lg:w-[26rem] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:rounded-none lg:p-0 lg:shadow-[10px_0_28px_-18px_rgb(65_57_111/0.55)] xl:w-[28rem] ${
            lapor ? 'max-h-[64%]' : estimasi ? 'max-h-[50%]' : 'max-h-[46%]'
          }`}
        >
          <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-ink/15 lg:hidden" />
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-6 lg:pb-6 lg:pt-12">
            {lapor ? (
              <FormLaporan
                key="lapor"
                titik={lapor.titik}
                namaTitik={lapor.nama}
                onLokasiSaya={lokasiSaya}
                onBatal={() => setLapor(null)}
                onKirim={kirimLaporan}
              />
            ) : estimasi ? (
              <>
                <h2 className="font-serif text-[1.375rem] leading-tight">{tr('Jalan utama sekarang')}</h2>
                <TrafficLegend className="mb-2 mt-2" />
                <DaftarKoridor state={koridor} pilih={pilih} onPilih={setPilih} onRetry={muatUlang} />
              </>
            ) : (
              <>
                {aktif ? (
                  <DetailLaporan
                    laporan={aktif}
                    now={now}
                    onTutup={() => setAktif(null)}
                    onKonfirmasi={konfirmasiLaporan}
                    mengirim={konfirmasi}
                  />
                ) : (
                  <>
                    <h2 className="font-serif text-[1.375rem] leading-tight">
                      {laporan.length ? tr("{0} laporan warga di area ini", { 0: laporan.length }) : tr('Belum ada laporan di area ini')}
                    </h2>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink/65">
                      {laporan.length
                        ? tr('Ketuk penanda untuk melihat detail atau mengonfirmasi.')
                        : tr('Lihat kemacetan, banjir, atau penutupan jalan? Ketuk Laporkan supaya warga lain tahu.')}
                    </p>
                  </>
                )}
                <TrafficLegend className="mt-4" />
              </>
            )}
          </div>
          <BottomActionBar actions={aksi} className="hidden lg:block lg:rounded-t-[1.75rem]" />
        </section>
      </div>

      <BottomActionBar actions={aksi} className="lg:hidden" />
    </PageShell>
  )
}
