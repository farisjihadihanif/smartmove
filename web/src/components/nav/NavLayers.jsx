import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { CircleMarker, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'

// Lapisan peta Smart Navigation: garis rute (warna mockup), titik asal, pin tujuan,
// titik langkah aktif saat Play, ketukan peta, dan penyesuaian tampilan.

const PIN_TUJUAN = L.divIcon({
  className: 'nav-pin',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43c-1.3-6.2-4.9-10.3-9-14.6A14.5 14.5 0 1 1 26 28.4C21.9 32.7 18.3 36.8 17 43Z" fill="#F44336" stroke="#8E1B12" stroke-width="2"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
})

const keLatLng = ([lng, lat]) => [lat, lng]

/** Padding fitBounds: ruang untuk lembar bawah (ponsel) atau panel kiri (desktop). */
function paddingRute() {
  const lebar = window.matchMedia('(min-width: 64rem)').matches
  return lebar
    ? { paddingTopLeft: [460, 96], paddingBottomRight: [64, 72] }
    : { paddingTopLeft: [28, 96], paddingBottomRight: [28, Math.round(window.innerHeight * 0.42)] }
}

/** Pusat peta agar `titik` tampil di area yang tidak tertutup lembar bawah / panel kiri. */
function pusatTerlihat(map, titik, zoom) {
  const lebar = window.matchMedia('(min-width: 64rem)').matches
  const geser = lebar ? L.point(-220, 0) : L.point(0, Math.round(map.getSize().y * 0.22))
  return map.unproject(map.project(titik, zoom).add(geser), zoom)
}

function Peristiwa({ onPick, onMove }) {
  const map = useMapEvents({
    click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    moveend: () => {
      const c = map.getCenter()
      onMove?.({ lat: c.lat, lng: c.lng })
    },
  })
  return null
}

function Penyesuai({ garis, fitKey, fokus, titikTunggal }) {
  const map = useMap()
  useEffect(() => {
    if (garis.length > 1) map.fitBounds(L.latLngBounds(garis), { ...paddingRute(), maxZoom: 17 })
    // fitKey: tombol Rute meminta tampilan seluruh rute lagi.
  }, [map, garis, fitKey])
  useEffect(() => {
    if (fokus) map.flyTo(pusatTerlihat(map, fokus, 17), 17, { duration: 0.6 })
  }, [map, fokus])
  useEffect(() => {
    if (!titikTunggal || garis.length > 1) return
    const zoom = Math.max(map.getZoom(), 15)
    map.flyTo(pusatTerlihat(map, titikTunggal, zoom), zoom, { duration: 0.6 })
  }, [map, titikTunggal, garis.length])
  return null
}

export default function NavLayers({ dari, ke, rute, langkahAktif, fitKey, onPick, onMove }) {
  const garis = useMemo(() => (rute?.garis ?? []).map(keLatLng), [rute])
  const fokus = useMemo(() => (langkahAktif?.lokasi ? keLatLng(langkahAktif.lokasi) : null), [langkahAktif])
  const tunggal = ke?.lokasi ?? dari?.lokasi
  const titikTunggal = useMemo(() => (tunggal ? [tunggal.lat, tunggal.lng] : null), [tunggal])

  return (
    <>
      <Peristiwa onPick={onPick} onMove={onMove} />
      <Penyesuai garis={garis} fitKey={fitKey} fokus={fokus} titikTunggal={titikTunggal} />
      {garis.length > 1 && (
        <>
          <Polyline positions={garis} pathOptions={{ color: '#0A11D8', weight: 9, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
          <Polyline positions={garis} pathOptions={{ color: '#0F53FF', weight: 6, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
        </>
      )}
      {dari && (
        <CircleMarker
          center={[dari.lokasi.lat, dari.lokasi.lng]}
          radius={8}
          pathOptions={{ color: '#41396F', weight: 4, fillColor: '#FFFFFF', fillOpacity: 1 }}
          interactive={false}
        />
      )}
      {ke && <Marker position={[ke.lokasi.lat, ke.lokasi.lng]} icon={PIN_TUJUAN} keyboard={false} interactive={false} />}
      {fokus && (
        <CircleMarker
          center={fokus}
          radius={11}
          pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: '#A2028A', fillOpacity: 1 }}
          interactive={false}
        />
      )}
    </>
  )
}
