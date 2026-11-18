// Helper Smart Navigation (T-107). Sama dengan mobile/lib/navigasi.dart – ubah bersamaan.

/** Pilihan moda di UI (API_SPECS §2: driving | motorcycle | walking). */
export const MODA = [
  { value: 'driving', label: 'Mobil' },
  { value: 'motorcycle', label: 'Motor' },
  { value: 'walking', label: 'Jalan kaki' },
]

/** Durasi detik → "12 mnt", "1 j 5 mnt", "< 1 mnt". */
export function formatDurasi(detik) {
  const menit = Math.round((Number(detik) || 0) / 60)
  if (menit < 1) return '< 1 mnt'
  if (menit < 60) return `${menit} mnt`
  const jam = Math.floor(menit / 60)
  const sisa = menit % 60
  return sisa ? `${jam} j ${sisa} mnt` : `${jam} j`
}

/** Jarak meter → "350 m", "4,9 km", "12 km". */
export function formatJarak(meter) {
  const m = Math.max(0, Math.round(Number(meter) || 0))
  if (m < 1000) return `${m} m`
  const km = m / 1000
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`
}

/** Ringkasan rute untuk teks (DESIGN §6: "Rute tercepat 12 mnt · 4,9 km"). */
export const ringkasRute = (rute) => `${formatDurasi(rute.durasiS)} · ${formatJarak(rute.jarakM)}`

/** Tautan rute di openstreetmap.org (dibuka siapa saja tanpa akun/aplikasi). */
export function tautanOsm(dari, ke, mode) {
  const engine = mode === 'walking' ? 'fossgis_osrm_foot' : 'fossgis_osrm_car'
  const t = (p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
  return `https://www.openstreetmap.org/directions?engine=${engine}&route=${t(dari)}%3B${t(ke)}`
}

/** Teks yang dibagikan tombol Share. */
export function teksBagikan({ dari, ke, mode, rute }) {
  const moda = MODA.find((m) => m.value === mode)?.label.toLowerCase() ?? ''
  return [
    `Rute ${moda} ke ${ke.nama}: ${ringkasRute(rute)}`,
    `Dari ${dari.nama}`,
    tautanOsm(dari.lokasi, ke.lokasi, mode),
  ].join('\n')
}

/** Titik untuk Street view: langkah aktif saat Play, lalu tujuan, lalu tengah peta. */
export function titikFoto({ langkah, ke, tengah }) {
  if (langkah?.lokasi) return { lat: langkah.lokasi[1], lng: langkah.lokasi[0] }
  if (ke) return ke.lokasi
  return tengah
}

/** Tanggal foto "28 Okt 2024" (WIB). */
export function tanggalFoto(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}
