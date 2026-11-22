import { tr } from '../lib/i18n.js'
import 'leaflet/dist/leaflet.css'
import { AttributionControl, MapContainer, TileLayer } from 'react-leaflet'
import { MEDAN_CENTER } from '../lib/geo.js'

// ARCHITECTURE: tile diambil langsung dari OSM dengan atribusi; rute/pencarian tetap lewat API.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * Peta OSM + atribusi wajib. `children` = lapisan react-leaflet (Polyline, Marker, …).
 * `tucked`: peta diselipkan 28 px di bawah header & bar bawah yang bersudut bulat (pengganti
 * "tutup atas ungu" mockup hal. 4 & 6); atribusi OSM ikut naik/turun agar tetap terlihat.
 * `attribution`: posisi atribusi (`bottomright` bawaan; `topright` bila bawah tertutup lembar bawah).
 */
export default function MapView({
  center = MEDAN_CENTER,
  zoom = 14,
  tucked = false,
  label = tr('Peta'),
  attribution = 'bottomright',
  className = '',
  children,
  ...rest
}) {
  return (
    <div className={`relative flex min-h-0 flex-col ${tucked ? 'map-tucked -my-7' : ''} ${className}`}>
      <div className="relative min-h-0 flex-1 overflow-hidden" role="region" aria-label={label}>
        <MapContainer
          center={center}
          zoom={zoom}
          zoomControl={false}
          attributionControl={false}
          className="absolute inset-0 z-0 h-full w-full"
          {...rest}
        >
          {/* Tanpa prefiks "Leaflet" agar teks atribusi OSM muat utuh di layar 360 px. */}
          <AttributionControl position={attribution} prefix={false} />
          <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
          {children}
        </MapContainer>
      </div>
    </div>
  )
}
