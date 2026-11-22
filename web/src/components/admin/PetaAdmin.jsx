import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import MapView from '../MapView.jsx'
import { tr } from '../../lib/i18n.js'

// Peta dasbor admin (DESIGN §7): garis koridor yang titiknya bisa digeser,
// penanda (halte / event) yang bisa digeser, dan ketukan peta untuk menambah.

const ikonTitik = (warna, aktif) =>
  L.divIcon({
    className: 'nav-pin',
    html: `<span style="display:block;width:${aktif ? 18 : 14}px;height:${aktif ? 18 : 14}px;border-radius:50%;background:#fff;border:3px solid ${warna};box-shadow:0 1px 4px rgb(0 0 0/.4)"></span>`,
    iconSize: [aktif ? 18 : 14, aktif ? 18 : 14],
    iconAnchor: [aktif ? 9 : 7, aktif ? 9 : 7],
  })

const ikonPin = (warna, aktif) =>
  L.divIcon({
    className: 'nav-pin',
    html: `<svg width="${aktif ? 34 : 28}" height="${aktif ? 44 : 36}" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43c-1.3-6.2-4.9-10.3-9-14.6A14.5 14.5 0 1 1 26 28.4C21.9 32.7 18.3 36.8 17 43Z" fill="${warna}" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>`,
    iconSize: [aktif ? 34 : 28, aktif ? 44 : 36],
    iconAnchor: [aktif ? 17 : 14, aktif ? 43 : 35],
  })

function Ketukan({ onPick }) {
  useMapEvents({ click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

/** Sesuaikan tampilan saat `kunci` berubah (mis. memilih koridor lain). */
function Pas({ titik, kunci }) {
  const map = useMap()
  useEffect(() => {
    if (titik.length > 1) map.fitBounds(L.latLngBounds(titik), { padding: [32, 32], maxZoom: 16 })
    else if (titik.length === 1) map.setView(titik[0], Math.max(map.getZoom(), 15))
    // Hanya saat kunci berganti, bukan setiap titik digeser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, kunci])
  return null
}

/**
 * - `garis`: [[lng, lat]]; `editGaris` + `onGaris`: titik garis bisa digeser.
 * - `penanda`: [{ id, lokasi: {lat, lng}, judul, warna?, aktif? }]; `onGeser(id, lokasi)` bila bisa digeser,
 *   `onPilih(id)` saat diketuk.
 * - `onPick(lokasi)`: ketukan peta kosong. `kunci`: ganti untuk menyesuaikan tampilan lagi.
 */
export default function PetaAdmin({
  garis = [],
  warnaGaris = '#0F53FF',
  editGaris = false,
  onGaris,
  penanda = [],
  onGeser,
  onPilih,
  onPick,
  kunci,
  className = 'h-[22rem] lg:h-[30rem]',
  label = tr('Peta'),
}) {
  const latlng = useMemo(() => garis.map(([lng, lat]) => [lat, lng]), [garis])
  const semua = useMemo(
    () => [...latlng, ...penanda.filter((p) => p.lokasi).map((p) => [p.lokasi.lat, p.lokasi.lng])],
    [latlng, penanda],
  )

  return (
    <div className={`overflow-hidden rounded-2xl ring-1 ring-ink/10 ${className}`}>
      <MapView zoom={13} className="h-full" label={label}>
        <Ketukan onPick={onPick} />
        <Pas titik={semua} kunci={kunci} />
        {latlng.length > 1 && (
          <>
            <Polyline positions={latlng} pathOptions={{ color: '#fff', weight: 9, opacity: 0.9 }} interactive={false} />
            <Polyline positions={latlng} pathOptions={{ color: warnaGaris, weight: 5 }} interactive={false} />
          </>
        )}
        {editGaris &&
          latlng.map((p, i) => (
            <Marker
              key={`v${i}`}
              position={p}
              draggable
              icon={ikonTitik(warnaGaris, false)}
              title={tr('Titik {0}', { 0: i + 1 })}
              alt={tr("Titik garis {0}", { 0: i + 1 })}
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng()
                  onGaris?.(garis.map((g, j) => (j === i ? [lng, lat] : g)))
                },
              }}
            />
          ))}
        {penanda
          .filter((p) => p.lokasi)
          .map((p) => (
            <Marker
              key={p.id}
              position={[p.lokasi.lat, p.lokasi.lng]}
              draggable={Boolean(onGeser)}
              icon={ikonPin(p.warna ?? '#A2028A', p.aktif)}
              zIndexOffset={p.aktif ? 800 : 0}
              title={p.judul}
              alt={p.judul}
              eventHandlers={{
                click: () => onPilih?.(p.id),
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng()
                  onGeser?.(p.id, { lat, lng })
                },
              }}
            />
          ))}
      </MapView>
    </div>
  )
}
