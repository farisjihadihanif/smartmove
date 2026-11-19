// Helper rute transportasi umum (T-203, API_SPECS §6.2). Sama dengan mobile/lib/transit.dart – ubah bersamaan.
import { formatDurasi, formatJarak } from './navigasi.js'

/** Warna garis per kendaraan yang dinaiki (urutan naik), sama di peta & lembar rute. Jalan kaki: titik-titik ink-violet. */
export const WARNA_NAIK = ['#A2028A', '#1E63C3']
export const WARNA_JALAN = '#41396F'
export const warnaNaik = (i) => WARNA_NAIK[i % WARNA_NAIK.length]

export const LABEL_JENIS = { angkot: 'Angkot', bus: 'Bus', kereta: 'Kereta' }

/** "KPUM 69 : Gabion → Term. P. Induk" → { nama: "KPUM 69", trayek: "Gabion → Term. P. Induk" }. */
export function namaKoridor(k) {
  const [nama, ...sisa] = String(k?.nama ?? k?.kode ?? '').split(' : ')
  return { nama: nama.trim() || k?.kode || '', trayek: sisa.join(' : ').trim() }
}

/** Nama jalan dari OSRM disingkat seperti papan jalan: "Jalan Almamater" → "Jl. Almamater". */
export const singkatJalan = (nama) => String(nama ?? '').replace(/^Jalan\s+/i, 'Jl. ')

const CADANGAN = /^Titik (naik|turun|pindah)/i
const adaNamaJalan = (nama) => Boolean(nama) && !CADANGAN.test(nama)

/** Rupiah atau "tarif belum tersedia" (null = belum diisi admin, jangan dianggap 0). */
export const teksTarif = (n) =>
  n === null || n === undefined ? 'tarif belum tersedia' : `Rp${Math.round(n).toLocaleString('id-ID')}`

/** Kalimat naik/turun satu bagian `naik`. Angkot tidak punya halte: naik di sepanjang jalan. */
export function teksNaik(b) {
  if (b.dari.nama === 'Lokasi asal') return 'Naik di titik asalmu'
  if (b.dari.nama === 'Titik pindah') return 'Naik di titik pindah, tempat kamu turun tadi'
  if (b.naikDiMana) {
    return adaNamaJalan(b.dari.nama)
      ? `Naik di sepanjang ${singkatJalan(b.dari.nama)}`
      : 'Naik di titik terdekat di jalur trayek'
  }
  return `Naik di ${b.dari.nama}`
}
export function teksTurun(b) {
  if (b.ke.nama === 'Tujuan') return 'Turun di tujuan'
  if (b.ke.nama === 'Titik pindah') return 'Turun di titik pindah'
  if (b.naikDiMana) {
    return adaNamaJalan(b.ke.nama) ? `Turun di sekitar ${singkatJalan(b.ke.nama)}` : 'Turun di titik terdekat tujuan'
  }
  return `Turun di ${b.ke.nama}`
}

/** "Jalan kaki 105 m ke Jl. Almamater". `terakhir` = menuju tujuan. */
export function teksJalan(b, terakhir) {
  const ke = terakhir ? 'tujuan' : adaNamaJalan(b.ke.nama) ? singkatJalan(b.ke.nama) : 'titik naik'
  return `Jalan kaki ${formatJarak(b.jarakM)} ke ${ke}`
}

/** "Naik angkot KPUM 69" (judul bagian naik). */
export const judulNaik = (b) =>
  `Naik ${(LABEL_JENIS[b.koridor.jenis] ?? '').toLowerCase()} ${namaKoridor(b.koridor).nama}`.replace(/\s+/g, ' ')

/** Kalimat utama satu bagian (Play & teks Share). */
export function teksBagian(b, i, bagian) {
  if (b.jenis === 'jalan') return teksJalan(b, i === bagian.length - 1)
  return `${judulNaik(b)} ${teksNaik(b).replace(/^Naik /, '')}, ${teksTurun(b).replace(/^Turun/, 'turun')}`
}

/** Urutan naik per bagian (null untuk jalan kaki) → indeks warna. */
export function indeksNaik(bagian) {
  let n = -1
  return bagian.map((b) => (b.jenis === 'naik' ? ++n : null))
}

/** Jarak total opsi (jalan + naik). */
export const jarakOpsi = (o) => o.bagian.reduce((s, b) => s + (b.jarakM || 0), 0)

/** Garis satu bagian sebagai [[lat,lng]]; bagian tanpa garis = garis lurus dari → ke. */
export function garisBagian(b) {
  if (b.garis?.length > 1) return b.garis.map(([lng, lat]) => [lat, lng])
  return [
    [b.dari.lokasi.lat, b.dari.lokasi.lng],
    [b.ke.lokasi.lat, b.ke.lokasi.lng],
  ]
}

/** Ringkasan satu baris: "1× pindah · jalan 271 m · tarif belum tersedia". */
export function ringkasOpsi(o) {
  return [
    o.transfer ? `${o.transfer}× pindah` : 'Tanpa pindah',
    `jalan ${formatJarak(o.jalanM)}`,
    o.tarif === null ? 'tarif belum tersedia' : teksTarif(o.tarif),
  ].join(' · ')
}

/** Ringkasan untuk Trip Planner (`ringkasan` rencana). */
export const ringkasanTrip = (o) => ({ durasiS: o.totalS, jarakM: jarakOpsi(o), tarif: o.tarif })

/** Teks tombol Share untuk rute transportasi umum. */
export function teksBagikanTransit({ dari, ke, opsi }) {
  const baris = opsi.bagian.map((b, i) => `${i + 1}. ${teksBagian(b, i, opsi.bagian)}`)
  return [
    `Rute transportasi umum ke ${ke.nama}: ${formatDurasi(opsi.totalS)}, ${opsi.tarif === null ? 'tarif belum tersedia' : teksTarif(opsi.tarif)}`,
    `Dari ${dari.nama}`,
    ...baris,
  ].join('\n')
}
