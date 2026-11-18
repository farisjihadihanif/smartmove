import 'leaflet/dist/leaflet.css'
import { AttributionControl, MapContainer, TileLayer } from 'react-leaflet'
import { MEDAN_CENTER } from '../lib/geo.js'

// ARCHITECTURE: tile diambil langsung dari OSM dengan atribusi; rute/pencarian tetap lewat API.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * Peta OSM + atribusi wajib. `children` = lapisan react-leaflet (Polyline, Marker, …).
 * `capped` menambah tutup atas ungu melengkung seperti mockup hal. 4 & 6.
 */
export default function MapView({
  center = MEDAN_CENTER,
  zoom = 14,
  capped = false,
  label = 'Peta',
  className = '',
  children,
  ...rest
}) {
  return (
    <div className={`relative flex min-h-0 flex-col ${className}`}>
      {capped && <div aria-hidden="true" className="relative z-[1] mx-1 -mb-3 h-7 shrink-0 rounded-t-[1.75rem] bg-ink-violet" />}
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
          <AttributionControl position="bottomright" prefix={false} />
          <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
          {children}
        </MapContainer>
      </div>
    </div>
  )
}
