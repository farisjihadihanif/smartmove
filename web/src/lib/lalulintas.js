// Live Traffic Information (T-205): label, warna, dan teks untuk laporan & koridor.
// Samakan dengan mobile/lib/lalulintas.dart.
import { formatDurasi, formatJarak } from './navigasi.js'

export const TINGKAT = {
  lancar: { label: 'Lancar', warna: '#2E9E5B' },
  padat: { label: 'Padat', warna: '#FFA000' },
  macet: { label: 'Macet', warna: '#F44336' },
}
/** Koridor tanpa laporan: warna garis rute mockup, waktu = waktu tempuh normal. */
export const TANPA_DATA = { label: 'Belum ada laporan', warna: '#0F53FF' }

export const KEJADIAN = {
  none: 'Tidak ada',
  kecelakaan: 'Kecelakaan',
  banjir: 'Banjir',
  penutupan: 'Penutupan jalan',
  perbaikan_jalan: 'Perbaikan jalan',
}

export const infoTingkat = (t) => TINGKAT[t] ?? TANPA_DATA

/** Detik → "12 mnt"; null → "–". */
export const formatMenit = (detik) => (detik == null ? '–' : formatDurasi(detik))

/** Meter → "4,9 km"; null → "". */
export const formatKm = (m) => (m == null ? '' : formatJarak(m))

/** Tambahan waktu dibanding normal, mis. "+4 mnt"; kosong bila < 1 menit. */
export function teksTunda(k) {
  if (k?.durasiS == null || k?.durasiNormalS == null) return ''
  const m = Math.round((k.durasiS - k.durasiNormalS) / 60)
  return m >= 1 ? `+${m} mnt` : ''
}

/** Titik tengah garis [[lng,lat],…] (menurut jumlah titik, cukup untuk label) → [lat,lng]. */
export function titikTengah(garis) {
  if (!garis?.length) return null
  const [lng, lat] = garis[Math.floor(garis.length / 2)]
  return [lat, lng]
}

/** bbox "minLng,minLat,maxLng,maxLat" dari batas Leaflet, dipotong ke maks. 1° (API_SPECS §6.3). */
export function bboxDari(b) {
  const c = b.getCenter()
  const setLng = Math.min(0.5, (b.getEast() - b.getWest()) / 2)
  const setLat = Math.min(0.5, (b.getNorth() - b.getSouth()) / 2)
  const f = (n) => n.toFixed(4)
  return [f(c.lng - setLng), f(c.lat - setLat), f(c.lng + setLng), f(c.lat + setLat)].join(',')
}

/** Ringkasan untuk Share. */
export function teksBagikanLaluLintas(koridor) {
  const baris = koridor
    .filter((k) => k.tersedia)
    .map((k) => {
      const t = k.tingkat ? infoTingkat(k.tingkat).label.toLowerCase() : 'belum ada laporan'
      const tunda = teksTunda(k)
      return `• ${k.nama}: ${formatMenit(k.durasiS)}${tunda ? ` (${tunda})` : ''}, ${t}${k.ditutup ? ', ada penutupan' : ''}`
    })
  return ['Lalu lintas Medan sekarang (SmartMove Medan):', ...baris].join('\n')
}

export const PESAN_TERKIRIM = 'Laporan terkirim. Terima kasih sudah membantu warga Medan!'
export const PESAN_DIGABUNG = 'Laporanmu menguatkan laporan warga lain di dekat situ. Terima kasih!'
