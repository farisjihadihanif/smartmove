import { httpError } from './httpError.js';

// Batas wilayah layanan: Medan dan sekitarnya (Mebidang = Medan, Binjai, Deli Serdang).
// Kotak kasar yang mencakup Binjai (barat), Belawan (utara), Kualanamu (timur) dan
// Pancur Batu/Sibolangit (selatan). Cukup untuk menolak titik yang jelas di luar.
export const MEBIDANG = { minLat: 3.25, maxLat: 3.9, minLng: 98.35, maxLng: 99.0 };

export const dalamWilayah = ({ lat, lng }, b = MEBIDANG) =>
  lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;

const LATLNG_RE = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

// "lat,lng" dari query → { lat, lng }. Melempar 400 bila formatnya salah.
export function parseLatLng(v, nama = 'Koordinat') {
  const m = typeof v === 'string' ? v.trim().match(LATLNG_RE) : null;
  const lat = m ? Number(m[1]) : NaN;
  const lng = m ? Number(m[2]) : NaN;
  if (!m || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw httpError(400, `${nama} harus berformat lat,lng`);
  }
  return { lat, lng };
}

export function wajibDalamWilayah(titik) {
  if (!dalamWilayah(titik)) {
    throw httpError(422, 'SmartMove baru melayani Medan dan sekitarnya', 'DI_LUAR_WILAYAH');
  }
  return titik;
}

// Jarak garis lurus (meter), rumus haversine.
export function jarakMeter(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
