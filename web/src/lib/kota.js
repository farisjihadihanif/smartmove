// Config kota aktif di klien (T-112). Cerminan api/src/cities/<kota>.js untuk bagian yang
// dipakai peta & waktu; kota dipilih saat build lewat VITE_CITY (bawaan: medan).
// Rencana multi-kota: docs/ARCHITECTURE.md §11.
const KOTA = {
  medan: {
    id: 'medan',
    nama: 'Medan',
    // Kotak Mebidang (sama dengan API) dan pusat kota (Lapangan Merdeka).
    batas: { minLat: 3.25, maxLat: 3.9, minLng: 98.35, maxLng: 99.0 },
    pusat: { lat: 3.5913, lng: 98.6776 },
    // WIB = UTC+7, tanpa musim panas.
    zonaWaktu: { nama: 'WIB', iana: 'Asia/Jakarta', offset: '+07:00', offsetMs: 7 * 60 * 60 * 1000 },
  },
}

const kota = KOTA[(import.meta.env?.VITE_CITY || 'medan').toLowerCase()] ?? KOTA.medan
export default kota
