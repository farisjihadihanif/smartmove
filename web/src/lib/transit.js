import { tr, locale } from './i18n.js'
// Helper rute transportasi umum (T-203, API_SPECS §6.2). Sama dengan mobile/lib/transit.dart – ubah bersamaan.
import { formatDurasi, formatJarak } from './navigasi.js'

/** Warna garis per kendaraan yang dinaiki (urutan naik), sama di peta & lembar rute. Jalan kaki: titik-titik ink-violet. */
export const WARNA_NAIK = ['#A2028A', '#1E63C3']
export const WARNA_JALAN = '#41396F'
export const warnaNaik = (i) => WARNA_NAIK[i % WARNA_NAIK.length]

export const LABEL_JENIS = { angkot: tr('Angkot'), bus: tr('Bus'), kereta: tr('Kereta') }

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
  n === null || n === undefined ? tr('tarif belum tersedia') : `Rp${Math.round(n).toLocaleString(locale)}`

/** true bila tarif ada tapi bukan isian admin (tarif bawaan/OSM) → tampilkan "Tarif perkiraan". */
export const tarifPerkiraan = (x) => x?.tarif !== null && x?.tarif !== undefined && x?.tarifPerkiraan === true

/** Tarif satu baris teks: "Rp5.000 (perkiraan)" / "Rp5.000" / "tarif belum tersedia". */
export const teksTarifRingkas = (x) => `${teksTarif(x?.tarif ?? null)}${tarifPerkiraan(x) ? tr(' (perkiraan)') : ''}`

/** Kalimat naik/turun satu bagian `naik`. Angkot tidak punya halte: naik di sepanjang jalan. */
export function teksNaik(b) {
  if (b.dari.nama === 'Lokasi asal') return tr('Naik di titik asalmu')
  if (b.dari.nama === 'Titik pindah') return tr('Naik di titik pindah, tempat kamu turun tadi')
  if (b.naikDiMana) {
    return adaNamaJalan(b.dari.nama)
      ? tr("Naik di sepanjang {0}", { 0: singkatJalan(b.dari.nama) })
      : tr('Naik di titik terdekat di jalur trayek')
  }
  return tr("Naik di {0}", { 0: b.dari.nama })
}
export function teksTurun(b) {
  if (b.ke.nama === 'Tujuan') return tr('Turun di tujuan')
  if (b.ke.nama === 'Titik pindah') return tr('Turun di titik pindah')
  if (b.naikDiMana) {
    return adaNamaJalan(b.ke.nama) ? tr("Turun di sekitar {0}", { 0: singkatJalan(b.ke.nama) }) : tr('Turun di titik terdekat tujuan')
  }
  return tr("Turun di {0}", { 0: b.ke.nama })
}

/** "Jalan kaki 105 m ke Jl. Almamater". `terakhir` = menuju tujuan. */
export function teksJalan(b, terakhir) {
  const ke = terakhir ? 'tujuan' : adaNamaJalan(b.ke.nama) ? singkatJalan(b.ke.nama) : tr('titik naik')
  return tr("Jalan kaki {0} ke {1}", { 0: formatJarak(b.jarakM), 1: ke })
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
    o.transfer ? tr("{0}× pindah", { 0: o.transfer }) : tr('Tanpa pindah'),
    `jalan ${formatJarak(o.jalanM)}`,
    teksTarifRingkas(o),
  ].join(' · ')
}

/** Ringkasan untuk Trip Planner (`ringkasan` rencana). */
export const ringkasanTrip = (o) => ({
  durasiS: o.totalS,
  jarakM: jarakOpsi(o),
  tarif: o.tarif,
  ...(tarifPerkiraan(o) ? { tarifPerkiraan: true } : {}),
})

/** Teks tombol Share untuk rute transportasi umum. */
export function teksBagikanTransit({ dari, ke, opsi }) {
  const baris = opsi.bagian.map((b, i) => `${i + 1}. ${teksBagian(b, i, opsi.bagian)}`)
  return [
    tr("Rute transportasi umum ke {0}: {1}, {2}", { 0: ke.nama, 1: formatDurasi(opsi.totalS), 2: teksTarifRingkas(opsi) }),
    `Dari ${dari.nama}`,
    ...baris,
  ].join('\n')
}
