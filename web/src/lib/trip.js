// Helper Trip Planner (T-109). Sama dengan mobile/lib/trip.dart – ubah bersamaan.
import { formatDurasi, formatJarak } from './navigasi.js'
import { teksTarifRingkas } from './transit.js'
import { hariWib, jamWib } from './wib.js'
import { tr } from './i18n.js'

/** Moda rencana (API: driving | motorcycle | walking | transit). */
export const MODA_TRIP = [
  { value: 'driving', label: tr('Mobil') },
  { value: 'motorcycle', label: tr('Motor') },
  { value: 'walking', label: tr('Jalan kaki') },
  { value: 'transit', label: tr('Transportasi umum') },
]
export const labelModa = (v) => MODA_TRIP.find((m) => m.value === v)?.label ?? v

const WIB_MS = 7 * 60 * 60 * 1000
const dua = (n) => String(n).padStart(2, '0')

/** ISO → isian form WIB { tanggal: "2026-11-19", jam: "07:30" }. */
export function keIsian(iso) {
  if (!iso) return { tanggal: '', jam: '' }
  const w = new Date(new Date(iso).getTime() + WIB_MS)
  return {
    tanggal: `${w.getUTCFullYear()}-${dua(w.getUTCMonth() + 1)}-${dua(w.getUTCDate())}`,
    jam: `${dua(w.getUTCHours())}:${dua(w.getUTCMinutes())}`,
  }
}

/** Isian form WIB → ISO UTC; jam kosong = tanpa jadwal (null). Tanggal kosong = hari ini (WIB). */
export function dariIsian({ tanggal, jam }, now = Date.now()) {
  if (!jam) return null
  const t = tanggal || keIsian(new Date(now).toISOString()).tanggal
  const d = new Date(`${t}T${jam}:00+07:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** "Berangkat dalam 25 mnt" / "Waktunya berangkat". */
export function hitungMundur(iso, now) {
  const s = (new Date(iso).getTime() - now) / 1000
  if (s < 60) return tr('Waktunya berangkat')
  return tr("Berangkat dalam {0}", { 0: formatDurasi(s) })
}

/** "12 mnt · 4,9 km" dari ringkasan tersimpan, atau null. Transit: + tarif ("tarif belum tersedia" bila kosong). */
export function teksRingkasan(r, moda) {
  if (!r || (r.durasiS === undefined && r.jarakM === undefined)) return null
  const bagian = []
  if (r.durasiS !== undefined) bagian.push(formatDurasi(r.durasiS))
  if (r.jarakM !== undefined) bagian.push(formatJarak(r.jarakM))
  if (moda === 'transit') bagian.push(teksTarifRingkas(r))
  return bagian.join(' · ')
}

/** Rencana terjadwal yang belum lewat lebih dari 30 menit dianggap akan datang. */
const LEWAT_MS = 30 * 60 * 1000
export const sudahLewat = (trip, now) =>
  Boolean(trip.berangkatPada) && new Date(trip.berangkatPada).getTime() < now - LEWAT_MS

/**
 * Kelompokkan rencana: per hari (akan datang, jam naik), "Kapan saja" (tanpa jadwal), lalu "Sudah lewat".
 * → { berikutnya, grup: [{ kunci, judul, items }], lewat: [] }
 */
export function kelompokkan(trips, now) {
  const akan = trips
    .filter((t) => t.berangkatPada && !sudahLewat(t, now))
    .sort((a, b) => new Date(a.berangkatPada) - new Date(b.berangkatPada))
  const bebas = trips.filter((t) => !t.berangkatPada)
  const lewat = trips
    .filter((t) => sudahLewat(t, now))
    .sort((a, b) => new Date(b.berangkatPada) - new Date(a.berangkatPada))

  const grup = []
  for (const t of akan) {
    const judul = hariWib(t.berangkatPada, now)
    const g = grup.at(-1)
    if (g?.judul === judul) g.items.push(t)
    else grup.push({ kunci: judul, judul, items: [t] })
  }
  if (bebas.length) grup.push({ kunci: 'bebas', judul: tr('Kapan saja'), items: bebas })
  return { berikutnya: akan[0] ?? null, grup, lewat }
}

export const jamTrip = (t) => (t.berangkatPada ? jamWib(t.berangkatPada) : null)

/** Moda yang bisa dipesankan: tiket (umum) atau parkir (mobil/motor). */
export const bisaDipesan = (trip) => trip.moda !== 'walking'

/** Tautan Digital Payment untuk memesan tiket/parkir rencana ini (T-302). */
export function tautanPesan(trip) {
  // Transportasi umum → tiket rute asal–tujuan; mobil/motor → parkir di tujuan.
  const q =
    trip.moda === 'transit'
      ? new URLSearchParams({ asal: trip.asal.nama, tujuan: trip.tujuan.nama })
      : new URLSearchParams({ asal: trip.tujuan.nama, jenis: 'parkir' })
  if (trip.berangkatPada) {
    q.set('tanggal', new Date(new Date(trip.berangkatPada).getTime() + 7 * 3600_000).toISOString().slice(0, 10))
  }
  return `/pembayaran?${q}`
}

/** Tautan Smart Navigation dengan asal, tujuan, dan moda rencana. */
export function tautanNavigasi(trip) {
  const p = (l) => `${l.lat},${l.lng}`
  const q = new URLSearchParams({
    dari: p(trip.asal.lokasi),
    ke: p(trip.tujuan.lokasi),
    mode: trip.moda,
    dariNama: trip.asal.nama,
    keNama: trip.tujuan.nama,
  })
  return `/navigasi?${q}`
}
