import { Fragment, useEffect, useMemo } from 'react'
import L from 'leaflet'
import { CircleMarker, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import { WARNA_JALAN, garisBagian, indeksNaik, warnaNaik } from '../../lib/transit.js'

// Lapisan peta Smart Navigation: garis rute (warna mockup), titik asal, pin tujuan,
// titik langkah aktif saat Play, ketukan peta, dan penyesuaian tampilan.
// Transportasi umum (`transit` = satu opsi GET /routes/transit): jalan kaki titik-titik ink-violet,
// tiap kendaraan garis berwarna sendiri (warnaNaik, sama dengan rel di lembar rute) + titik naik/turun.

const PIN_TUJUAN = L.divIcon({
  className: 'nav-pin',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43c-1.3-6.2-4.9-10.3-9-14.6A14.5 14.5 0 1 1 26 28.4C21.9 32.7 18.3 36.8 17 43Z" fill="#F44336" stroke="#8E1B12" stroke-width="2"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
})

const keLatLng = ([lng, lat]) => [lat, lng]

/** Padding fitBounds: ruang untuk lembar bawah (ponsel); di desktop panel rute ada di samping peta. */
function paddingRute() {
  const lebar = window.matchMedia('(min-width: 64rem)').matches
  return lebar
    ? { paddingTopLeft: [64, 92], paddingBottomRight: [64, 64] }
    : { paddingTopLeft: [28, 96], paddingBottomRight: [28, Math.round(window.innerHeight * 0.42)] }
}

/** Pusat peta agar `titik` tampil di area yang tidak tertutup lembar bawah (ponsel). Desktop: tepat di tengah. */
function pusatTerlihat(map, titik, zoom) {
  const lebar = window.matchMedia('(min-width: 64rem)').matches
  const geser = lebar ? L.point(0, -14) : L.point(0, Math.round(map.getSize().y * 0.22))
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

function LapisanTransit({ opsi }) {
  const urut = indeksNaik(opsi.bagian)
  const bagian = opsi.bagian.map((b, i) => ({ b, garis: garisBagian(b), warna: b.jenis === 'naik' ? warnaNaik(urut[i]) : null }))
  return (
    <>
      {bagian.map(({ b, garis }, i) =>
        b.jenis === 'jalan' ? (
          <Polyline
            key={`j${i}`}
            positions={garis}
            pathOptions={{ color: WARNA_JALAN, weight: 5, dashArray: '1 10', lineCap: 'round', lineJoin: 'round' }}
            interactive={false}
          />
        ) : null,
      )}
      {bagian.map(({ b, garis, warna }, i) =>
        b.jenis === 'naik' ? (
          <Fragment key={`n${i}`}>
            <Polyline positions={garis} pathOptions={{ color: '#FFFFFF', weight: 10, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
            <Polyline positions={garis} pathOptions={{ color: warna, weight: 6, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
            {[b.dari.lokasi, b.ke.lokasi].map((t, k) => (
              <CircleMarker
                key={k}
                center={[t.lat, t.lng]}
                radius={6}
                pathOptions={{ color: warna, weight: 4, fillColor: '#FFFFFF', fillOpacity: 1 }}
                interactive={false}
              />
            ))}
          </Fragment>
        ) : null,
      )}
    </>
  )
}

export default function NavLayers({ dari, ke, rute, transit, langkahAktif, fitKey, onPick, onMove }) {
  const garis = useMemo(
    () => (transit ? transit.bagian.flatMap(garisBagian) : (rute?.garis ?? []).map(keLatLng)),
    [rute, transit],
  )
  const fokus = useMemo(() => (langkahAktif?.lokasi ? keLatLng(langkahAktif.lokasi) : null), [langkahAktif])
  const tunggal = ke?.lokasi ?? dari?.lokasi
  const titikTunggal = useMemo(() => (tunggal ? [tunggal.lat, tunggal.lng] : null), [tunggal])

  return (
    <>
      <Peristiwa onPick={onPick} onMove={onMove} />
      <Penyesuai garis={garis} fitKey={fitKey} fokus={fokus} titikTunggal={titikTunggal} />
      {transit && <LapisanTransit opsi={transit} />}
      {!transit && garis.length > 1 && (
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
