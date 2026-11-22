import kota from './kota.js'

/** Pusat kota aktif (Medan: Lapangan Merdeka), [lat, lng]. */
export const PUSAT_KOTA = [kota.pusat.lat, kota.pusat.lng]

/** Titik di dalam kotak wilayah layanan kota aktif (sama dengan API). */
export const dalamWilayah = ({ lat, lng }, b = kota.batas) =>
  lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng
