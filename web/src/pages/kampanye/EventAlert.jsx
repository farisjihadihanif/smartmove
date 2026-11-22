import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { CalendarClock, MapPinOff, Navigation, Share2 } from 'lucide-react'
import { Marker, useMap } from 'react-leaflet'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BottomActionBar from '../../components/BottomActionBar.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import MapView from '../../components/MapView.jsx'
import PageShell from '../../components/PageShell.jsx'
import { infoJenisEvent, JENIS_EVENT, rentangEvent } from '../../lib/kampanye.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { tr } from '../../lib/i18n.js'

// EventAlert (T-207): event lalu lintas (CFD, rekayasa arus, acara) yang berlangsung & mendatang,
// penanda di peta untuk event berlokasi. ?id= memilih event (dari hub / notifikasi).


function ikon(e, aktif) {
  const w = infoJenisEvent(e.jenis).warna
  const s = aktif ? 46 : 38
  return L.divIcon({
    className: 'nav-pin',
    html: `<svg width="${s}" height="${Math.round(s * 1.2)}" viewBox="0 0 40 48" aria-hidden="true"><path d="M20 47c-1.4-6.6-5.2-11-9.6-15.6A15.5 15.5 0 1 1 29.6 31.4C25.2 36 21.4 40.4 20 47Z" fill="${w}" stroke="#fff" stroke-width="2.4"/><rect x="11.5" y="11" width="17" height="15" rx="2.5" fill="#fff"/><rect x="11.5" y="11" width="17" height="4.5" rx="1.5" fill="${w}" opacity=".55"/><path d="M15 9v4M25 9v4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    iconSize: [s, Math.round(s * 1.2)],
    iconAnchor: [s / 2, Math.round(s * 1.2) - 1],
  })
}

function Fokus({ titik }) {
  const map = useMap()
  useEffect(() => {
    if (!titik) return
    const lebar = window.matchMedia('(min-width: 64rem)').matches
    const z = Math.max(map.getZoom(), 15)
    const geser = lebar ? L.point(0, 0) : L.point(0, Math.round(map.getSize().y * 0.2))
    map.flyTo(map.unproject(map.project(titik, z).add(geser), z), z, { duration: 0.6 })
  }, [map, titik])
  return null
}

export default function EventAlert() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { status, data, error, muatUlang } = useApiGet('/campaign/events')
  const [now] = useState(() => Date.now())
  const [pesan, setPesan] = useState('')
  const items = useMemo(() => data?.items ?? [], [data])
  const pilihId = params.get('id')
  const pilih = items.find((e) => e.id === pilihId) ?? null
  const titik = useMemo(() => (pilih?.lokasi ? [pilih.lokasi.lat, pilih.lokasi.lng] : null), [pilih])

  const kelompok = [
    { judul: tr('Sedang berlangsung'), items: items.filter((e) => e.status === 'berlangsung') },
    { judul: tr('Mendatang'), items: items.filter((e) => e.status === 'mendatang') },
  ].filter((k) => k.items.length)

  const pilihEvent = (id) => setParams(id ? { id } : {}, { replace: true })

  async function bagikan() {
    if (!pilih) return
    const teks = tr("{0} ({1})\n{2}\n{3}\n\nEventAlert SmartMove Medan", { 0: pilih.judul, 1: infoJenisEvent(pilih.jenis).label, 2: rentangEvent(pilih, now), 3: pilih.isi })
    try {
      if (navigator.share) return await navigator.share({ title: pilih.judul, text: teks })
      await navigator.clipboard.writeText(teks)
      setPesan(tr('Info event disalin. Tempel di chat untuk membagikannya.'))
    } catch (e) {
      if (e?.name !== 'AbortError') setPesan(tr('Belum bisa dibagikan dari peramban ini.'))
    }
    setTimeout(() => setPesan(''), 3200)
  }

  const aksi = [
    {
      label: tr('Rute'),
      icon: Navigation,
      disabled: !pilih?.lokasi,
      onClick: () =>
        navigate(`/navigasi?${new URLSearchParams({ ke: `${pilih.lokasi.lat},${pilih.lokasi.lng}`, keNama: pilih.judul })}`),
    },
    { label: tr('Share'), icon: Share2, disabled: !pilih, onClick: bagikan },
  ]

  return (
    <PageShell map title={tr('EventAlert')} backTo="/kampanye" backLabel={tr('Kembali ke Kampanye')}>
      <div className="relative z-0 flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <MapView tucked zoom={13} attribution="topright" className="flex-1 lg:mb-0" label={tr('Peta EventAlert')}>
            <Fokus titik={titik} />
            {items
              .filter((e) => e.lokasi)
              .map((e) => (
                <Marker
                  key={e.id}
                  position={[e.lokasi.lat, e.lokasi.lng]}
                  icon={ikon(e, e.id === pilihId)}
                  zIndexOffset={e.id === pilihId ? 800 : 0}
                  title={e.judul}
                  alt={e.judul}
                  eventHandlers={{ click: () => pilihEvent(e.id) }}
                />
              ))}
          </MapView>
          {pesan && (
            <p
              role="status"
              className="sheet-fade absolute left-1/2 top-12 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-ink-violet px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              {pesan}
            </p>
          )}
        </div>

        <section
          aria-label={tr('Daftar event')}
          className="sheet-rise absolute inset-x-0 -bottom-7 z-10 max-h-[52%] overflow-y-auto rounded-t-[1.75rem] bg-surface px-5 pb-[calc(1.75rem+1rem)] pt-2 shadow-[0_-12px_32px_-14px_rgb(65_57_111/0.55)] lg:static lg:order-first lg:-mt-7 lg:flex lg:max-h-none lg:w-[26rem] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:rounded-none lg:p-0 lg:shadow-[10px_0_28px_-18px_rgb(65_57_111/0.55)] xl:w-[28rem]"
        >
          <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-ink/15 lg:hidden" />
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-6 lg:pb-6 lg:pt-12">
            {status === 'memuat' && <p className="py-6 text-sm text-ink/70">{tr('Memuat event…')}</p>}
            {status === 'galat' && <ErrorBanner error={error} onRetry={muatUlang} />}
            {status === 'ok' && items.length === 0 && (
              <EmptyState
                icon={CalendarClock}
                title={tr('Belum ada event')}
                message={tr('Car Free Day, rekayasa arus, dan acara yang memengaruhi jalan di Medan akan muncul di sini.')}
                className="py-6"
              />
            )}
            {kelompok.map((k) => (
              <section key={k.judul} className="mb-5 last:mb-0">
                <h2 className="font-serif text-[1.375rem] leading-tight">{k.judul}</h2>
                <ul className="mt-2">
                  {k.items.map((e) => (
                    <ItemEvent key={e.id} e={e} now={now} aktif={e.id === pilihId} onPilih={() => pilihEvent(e.id === pilihId ? null : e.id)} />
                  ))}
                </ul>
              </section>
            ))}
            {items.length > 0 && (
              <ul aria-label={tr('Jenis event')} className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink/70">
                {Object.values(JENIS_EVENT).map((j) => (
                  <li key={j.label} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: j.warna }} />
                    {j.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <BottomActionBar actions={aksi} className="hidden lg:block lg:rounded-t-[1.75rem]" />
        </section>
      </div>
      <BottomActionBar actions={aksi} className="lg:hidden" />
    </PageShell>
  )
}

function ItemEvent({ e, now, aktif, onPilih }) {
  const j = infoJenisEvent(e.jenis)
  return (
    <li>
      <button
        type="button"
        aria-pressed={aktif}
        onClick={onPilih}
        className={`-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-2xl px-2 py-3 text-left transition ${
          aktif ? 'bg-[color:rgb(218_184_246/0.35)]' : 'hover:bg-ink/[0.035]'
        }`}
      >
        <span aria-hidden="true" className="mt-1.5 size-3 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: j.warna }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug">{e.judul}</span>
          <span className="mt-0.5 block text-[13px] text-ink/60">
            {j.label}, {rentangEvent(e, now)}
          </span>
          {aktif && <span className="mt-2 block text-[15px] leading-relaxed text-ink/80">{e.isi}</span>}
          {!e.lokasi && (
            <span className="mt-1 flex items-center gap-1 text-[12px] text-ink/50">
              <MapPinOff size={13} aria-hidden="true" /> {tr('Tanpa titik di peta')}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
