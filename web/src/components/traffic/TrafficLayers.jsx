import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import { formatKm, formatMenit, infoTingkat, KEJADIAN, titikTengah, TINGKAT } from '../../lib/lalulintas.js'
import { tr } from '../../lib/i18n.js'

// Lapisan lalu lintas (T-205): koridor jalan utama (garis biru = belum ada laporan, ruas padat/macet
// berwarna), kotak waktu "12 mnt / 4,9 km" seperti mockup hal. 6, dan penanda laporan warga.
// Dipakai di Live Traffic Information dan mode Traffic Smart Navigation.

const keLatLng = ([lng, lat]) => [lat, lng]
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function ikonKotak(k, aktif) {
  const t = infoTingkat(k.tingkat)
  const warna = k.tingkat ? t.warna : '#C62828'
  return L.divIcon({
    className: 'lt-kotak-wrap',
    html: `<div class="lt-kotak${aktif ? ' lt-kotak-aktif' : ''}"><b style="color:${k.tingkat === 'padat' ? '#B26A00' : warna}">${esc(formatMenit(k.durasiS))}</b><span>${esc(formatKm(k.jarakM))}</span></div>`,
    iconSize: null,
    iconAnchor: [0, 0],
  })
}

// Penanda laporan: lingkaran warna tingkat + simbol kejadian (bentuk, bukan warna saja).
const SIMBOL = {
  none: '',
  kecelakaan: '<path d="M12 7v6M12 16.5v.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  banjir: '<path d="M6 13c2-1.6 4-1.6 6 0s4 1.6 6 0M6 17c2-1.6 4-1.6 6 0s4 1.6 6 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>',
  penutupan: '<rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="#fff"/>',
  perbaikan_jalan: '<path d="M12 6.5 18 17H6Z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
}
function ikonLaporan(r, aktif) {
  const warna = TINGKAT[r.tingkat]?.warna ?? '#41396F'
  const ukuran = aktif ? 38 : 30
  const isi = SIMBOL[r.kejadian] || `<circle cx="12" cy="12" r="3.2" fill="#fff"/>`
  return L.divIcon({
    className: 'nav-pin',
    html: `<svg width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="${warna}" stroke="#fff" stroke-width="2.2"/>${isi}</svg>`,
    iconSize: [ukuran, ukuran],
    iconAnchor: [ukuran / 2, ukuran / 2],
  })
}

const PIN_LAPOR = L.divIcon({
  className: 'nav-pin',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43c-1.3-6.2-4.9-10.3-9-14.6A14.5 14.5 0 1 1 26 28.4C21.9 32.7 18.3 36.8 17 43Z" fill="#A2028A" stroke="#41396F" stroke-width="2"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
})

function Peristiwa({ onPick, onArea, onZoom }) {
  const map = useMapEvents({
    click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    moveend: () => onArea?.(map.getBounds()),
    zoomend: () => onZoom?.(map.getZoom()),
  })
  const awal = useRef(false)
  useEffect(() => {
    if (awal.current) return
    awal.current = true
    onArea?.(map.getBounds())
  }, [map, onArea])
  return null
}

function Fokus({ garis, titik, padding }) {
  const map = useMap()
  useEffect(() => {
    if (garis?.length > 1) {
      map.fitBounds(L.latLngBounds(garis), { ...padding, maxZoom: 16, animate: false })
      // Jangan terlalu jauh: di bawah zoom 12 nama jalan dan kotak waktu tidak terbaca.
      if (map.getZoom() < 12) map.setView(L.latLngBounds(garis).getCenter(), 12, { animate: false })
    }
    // padding hanya dibaca saat garis berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, garis])
  useEffect(() => {
    if (titik) map.flyTo(titik, Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [map, titik])
  return null
}

/**
 * - `koridor`: items GET /traffic/corridors; `laporan`: items GET /traffic.
 * - `kotak`: tampilkan kotak waktu di tiap koridor (tab Estimasi Waktu).
 * - `pilihKoridor` / `onPilihKoridor`, `laporanAktif` / `onPilihLaporan`: pilihan & ketukan.
 * - `onPick`: ketukan peta kosong; `onArea`: batas peta berubah (untuk memuat laporan).
 * - `titikLapor`: pin titik laporan yang sedang dibuat. `fokusGaris`/`fokusTitik`: arahkan peta.
 */
export default function TrafficLayers({
  koridor = [],
  laporan = [],
  kotak = false,
  pilihKoridor = null,
  onPilihKoridor,
  laporanAktif = null,
  onPilihLaporan,
  onPick,
  onArea,
  titikLapor = null,
  fokusGaris = null,
  fokusTitik = null,
  padding = { padding: [40, 40] },
  redup = false,
}) {
  const garis = useMemo(
    () =>
      koridor.map((k) => ({
        k,
        garis: (k.garis ?? []).map(keLatLng),
        segmen: (k.segmen ?? []).map((s) => ({ tingkat: s.tingkat, garis: s.garis.map(keLatLng) })),
      })),
    [koridor],
  )

  // Kotak waktu hanya saat cukup dekat (zoom ≥ 12) supaya tidak bertumpuk; yang dipilih selalu tampil.
  const [zoom, setZoom] = useState(14)

  return (
    <>
      <Peristiwa onPick={onPick} onArea={onArea} onZoom={setZoom} />
      <Fokus garis={fokusGaris} titik={fokusTitik} padding={padding} />
      {garis.map(({ k, garis: g, segmen }) => {
        if (g.length < 2) return null
        const aktif = pilihKoridor === k.kode
        const dasar = k.tingkat === 'lancar' ? TINGKAT.lancar.warna : infoTingkat(null).warna
        const lebar = aktif ? 8 : 6
        const klik = onPilihKoridor ? { click: () => onPilihKoridor(k.kode) } : undefined
        return (
          <Fragment key={k.kode}>
            <Polyline
              positions={g}
              pathOptions={{ color: '#FFFFFF', weight: lebar + 4, opacity: redup ? 0.6 : 0.9, lineCap: 'round', lineJoin: 'round' }}
              interactive={false}
            />
            <Polyline
              positions={g}
              pathOptions={{ color: dasar, weight: lebar, opacity: redup ? 0.45 : aktif || !pilihKoridor ? 0.95 : 0.55, lineCap: 'round', lineJoin: 'round' }}
              eventHandlers={klik}
              bubblingMouseEvents={!klik}
            />
            {segmen.map((s, i) => (
              <Polyline
                key={i}
                positions={s.garis}
                pathOptions={{ color: TINGKAT[s.tingkat]?.warna, weight: lebar, opacity: redup ? 0.6 : 1, lineCap: 'butt', lineJoin: 'round' }}
                eventHandlers={klik}
                bubblingMouseEvents={!klik}
              />
            ))}
            {kotak && k.tersedia && (zoom >= 12 || aktif) && titikTengah(k.garis) && (
              <Marker
                position={titikTengah(k.garis)}
                icon={ikonKotak(k, aktif)}
                zIndexOffset={aktif ? 600 : 300}
                eventHandlers={klik}
                title={`${k.nama}: ${formatMenit(k.durasiS)}, ${formatKm(k.jarakM)}`}
                alt={`${k.nama}: ${formatMenit(k.durasiS)}`}
              />
            )}
          </Fragment>
        )
      })}
      {laporan.map((r) => (
        <Marker
          key={r.id}
          position={[r.lokasi.lat, r.lokasi.lng]}
          icon={ikonLaporan(r, laporanAktif?.id === r.id)}
          zIndexOffset={laporanAktif?.id === r.id ? 900 : 500}
          eventHandlers={onPilihLaporan ? { click: () => onPilihLaporan(r) } : undefined}
          title={`${TINGKAT[r.tingkat]?.label ?? ''}${r.kejadian !== 'none' ? ` · ${KEJADIAN[r.kejadian]}` : ''}`}
          alt={tr('Laporan {0}', { 0: TINGKAT[r.tingkat]?.label ?? '' })}
          interactive={Boolean(onPilihLaporan)}
        />
      ))}
      {titikLapor && <Marker position={[titikLapor.lat, titikLapor.lng]} icon={PIN_LAPOR} zIndexOffset={1000} interactive={false} />}
    </>
  )
}
