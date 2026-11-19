// Pemesanan & Digital Payment (simulasi, T-302). Data dari API: GET /payments/services,
// POST /payments, GET /payments(/:orderId), POST /payments/:orderId/cek.

export const LABEL_SIMULASI = 'Simulasi – bukan tiket resmi'

// Ikon tiap jenis & metode ada di components/pembayaran/ikon.js.
export const JENIS = [
  { value: 'kereta', label: 'Kereta' },
  { value: 'bus', label: 'Bus' },
  { value: 'bus_antarkota', label: 'Antarkota' },
  { value: 'travel', label: 'Travel' },
  { value: 'parkir', label: 'Parkir' },
]
export const labelJenis = (v) => JENIS.find((j) => j.value === v)?.label ?? v

// Metode di mockup hal. 5. "Pay for parking" bukan metode, melainkan pintasan ke layanan parkir.
export const METODE = [
  { value: 'kartu', label: 'Kartu kredit', ket: 'Visa, Mastercard, JCB' },
  { value: 'ewallet', label: 'E-Wallet', ket: 'GoPay, ShopeePay' },
  {
    value: 'transfer',
    label: 'Transfer bank',
    ket: 'Virtual account BCA, BNI, BRI, dan lainnya',
  },
  {
    value: 'qris',
    label: 'QRIS',
    ket: 'Pindai dari aplikasi bank atau e-wallet',
  },
]

export const STATUS = {
  menunggu: { label: 'Menunggu pembayaran', nada: 'padat' },
  lunas: { label: 'Lunas', nada: 'lancar' },
  gagal: { label: 'Gagal', nada: 'macet' },
  kedaluwarsa: { label: 'Kedaluwarsa', nada: 'abu' },
  dibatalkan: { label: 'Dibatalkan', nada: 'abu' },
}

// Nama metode dari Midtrans (`payment_type`) untuk riwayat & e-tiket.
const NAMA_METODE = {
  kartu: 'Kartu kredit',
  ewallet: 'E-Wallet',
  transfer: 'Transfer bank',
  qris: 'QRIS',
  credit_card: 'Kartu kredit',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  bank_transfer: 'Transfer bank',
  echannel: 'Transfer bank (Mandiri)',
  permata: 'Transfer bank (Permata)',
  cstore: 'Gerai ritel',
}
export const namaMetode = (m) => (m ? (NAMA_METODE[m] ?? m.replace(/_/g, ' ')) : null)

export const rupiah = (n) => `Rp${Math.round(n).toLocaleString('id-ID')}`

export const satuanLabel = (layanan) => (layanan.jenis === 'parkir' ? 'jam' : 'orang')
export const maksJumlah = (layanan) => (layanan.jenis === 'parkir' ? 24 : 8)

/** Rute layanan: "Stasiun Medan → Bandara Kualanamu" atau lokasi parkir. */
export const ruteLayanan = (l) => (l.tujuan ? `${l.asal ?? '—'} → ${l.tujuan}` : (l.asal ?? ''))

/** Tanggal WIB "YYYY-MM-DD" untuk `offset` hari dari `now`. */
export function tanggalWib(now = Date.now(), offset = 0) {
  const w = new Date(new Date(now).getTime() + 7 * 3600_000 + offset * 86_400_000)
  return w.toISOString().slice(0, 10)
}

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** "2026-11-20" → { hari: 'Jum', tgl: 20, bulan: 'Nov' } */
export function pecahTanggal(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  return {
    hari: HARI[d.getUTCDay()],
    tgl: d.getUTCDate(),
    bulan: BULAN[d.getUTCMonth()],
  }
}

/** Tanggal & jam WIB lengkap: "Jum, 20 Nov 2026 · 06.40 WIB". */
export function waktuLengkap(iso) {
  const w = new Date(new Date(iso).getTime() + 7 * 3600_000)
  const dua = (n) => String(n).padStart(2, '0')
  return `${HARI[w.getUTCDay()]}, ${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}, ${dua(w.getUTCHours())}.${dua(w.getUTCMinutes())} WIB`
}

/** Jam mulai parkir terdekat (kelipatan 15 menit ke depan) untuk tanggal WIB tertentu. */
export function slotParkir(tanggal, now = Date.now()) {
  const hariIni = tanggalWib(now) === tanggal
  const slot = []
  for (let m = 0; m < 24 * 60; m += 30) {
    const jam = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    const waktu = new Date(`${tanggal}T${jam}:00+07:00`)
    slot.push({
      jam,
      waktu: waktu.toISOString(),
      tersedia: !hariIni || waktu.getTime() > now - 15 * 60_000,
    })
  }
  return slot
}

/** Teks bagikan untuk Share (Web Share API / salin). */
export function teksBagikan({ layanan, jadwal, jumlah, penumpang, eTiket }) {
  const baris = [
    `${layanan.nama} (${LABEL_SIMULASI})`,
    ruteLayanan(layanan),
    jadwal ? waktuLengkap(jadwal) : null,
    `${penumpang} ${satuanLabel(layanan)} · ${rupiah(jumlah)}`,
    eTiket?.kode ? `Kode: ${eTiket.kode}` : null,
    'Dipesan lewat SmartMove Medan',
  ]
  return baris.filter(Boolean).join('\n')
}

export async function bagikan(teks) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'SmartMove Medan', text: teks })
      return 'dibagikan'
    } catch (e) {
      if (e?.name === 'AbortError') return null
    }
  }
  try {
    await navigator.clipboard.writeText(teks)
    return 'disalin'
  } catch {
    return null
  }
}
