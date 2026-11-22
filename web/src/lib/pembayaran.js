import { tr, locale } from './i18n.js'
import kota from './kota.js'
// Pemesanan & Digital Payment (simulasi, T-302). Data dari API: GET /payments/services,
// POST /payments, GET /payments(/:orderId), POST /payments/:orderId/cek.

export const LABEL_SIMULASI = tr('Simulasi – bukan tiket resmi')

// Ikon tiap jenis & metode ada di components/pembayaran/ikon.js.
export const JENIS = [
  { value: 'kereta', label: tr('Kereta') },
  { value: 'bus', label: tr('Bus') },
  { value: 'bus_antarkota', label: tr('Antarkota') },
  { value: 'travel', label: tr('Travel') },
  { value: 'parkir', label: tr('Parkir') },
]
export const labelJenis = (v) => JENIS.find((j) => j.value === v)?.label ?? v

// Metode bayar (Midtrans Core API, TASK Keputusan #19; tanpa kartu kredit). Dikelompokkan seperti
// mockup hal. 5; "Pay for parking" bukan metode, melainkan pintasan ke layanan parkir.
export const GRUP_METODE = [
  {
    value: 'qris',
    label: tr('QRIS'),
    ket: tr('Pindai kode QR dari aplikasi bank atau e-wallet mana pun'),
    pilihan: [{ value: 'qris', label: tr('QRIS') }],
  },
  {
    value: 'va',
    label: tr('Virtual account'),
    ket: tr('Transfer dari m-banking, internet banking, atau ATM'),
    pilihan: [
      { value: 'bca', label: tr('BCA') },
      { value: 'bni', label: tr('BNI') },
      { value: 'bri', label: tr('BRI') },
      { value: 'mandiri', label: tr('Mandiri') },
      { value: 'permata', label: tr('Permata') },
    ],
  },
  {
    value: 'ewallet',
    label: tr('E-wallet'),
    ket: tr('Bayar langsung di aplikasi GoPay atau ShopeePay'),
    pilihan: [
      { value: 'gopay', label: tr('GoPay') },
      { value: 'shopeepay', label: tr('ShopeePay') },
    ],
  },
]
export const grupDari = (metode) => GRUP_METODE.find((g) => g.pilihan.some((p) => p.value === metode))?.value ?? null

/** Simulator sandbox Midtrans: dipakai untuk "membayar" transaksi simulasi saat uji coba. */
export const SIMULATOR_MIDTRANS = 'https://simulator.sandbox.midtrans.com/'

export const STATUS = {
  menunggu: { label: tr('Menunggu pembayaran'), nada: 'padat' },
  lunas: { label: tr('Lunas'), nada: 'lancar' },
  gagal: { label: tr('Gagal'), nada: 'macet' },
  kedaluwarsa: { label: tr('Kedaluwarsa'), nada: 'abu' },
  dibatalkan: { label: tr('Dibatalkan'), nada: 'abu' },
}

// Nama metode dari Midtrans (`payment_type`) untuk riwayat & e-tiket.
const NAMA_METODE = {
  qris: 'QRIS',
  bca: tr('Virtual account BCA'),
  bni: tr('Virtual account BNI'),
  bri: tr('Virtual account BRI'),
  mandiri: tr('Mandiri Bill'),
  permata: tr('Virtual account Permata'),
  ewallet: 'E-Wallet',
  transfer: tr('Transfer bank'),
  credit_card: tr('Kartu kredit'),
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  bank_transfer: tr('Transfer bank'),
  echannel: tr('Transfer bank (Mandiri)'),
  cstore: tr('Gerai ritel'),
}
export const namaMetode = (m) => (m ? (NAMA_METODE[m] ?? m.replace(/_/g, ' ')) : null)

export const rupiah = (n) => `Rp${Math.round(n).toLocaleString(locale)}`

export const satuanLabel = (layanan) => (layanan.jenis === 'parkir' ? 'jam' : 'orang')
export const maksJumlah = (layanan) => (layanan.jenis === 'parkir' ? 24 : 8)

/** Rute layanan: "Stasiun Medan → Bandara Kualanamu" atau lokasi parkir. */
export const ruteLayanan = (l) => (l.tujuan ? `${l.asal ?? '—'} → ${l.tujuan}` : (l.asal ?? ''))

/** Tanggal WIB "YYYY-MM-DD" untuk `offset` hari dari `now`. */
export function tanggalWib(now = Date.now(), offset = 0) {
  const w = new Date(new Date(now).getTime() + 7 * 3600_000 + offset * 86_400_000)
  return w.toISOString().slice(0, 10)
}

const HARI = [tr('Min'), tr('Sen'), tr('Sel'), tr('Rab'), tr('Kam'), tr('Jum'), tr('Sab')]
const BULAN = [tr('Jan'), tr('Feb'), tr('Mar'), tr('Apr'), tr('Mei'), tr('Jun'), tr('Jul'), tr('Agu'), tr('Sep'), tr('Okt'), tr('Nov'), tr('Des')]

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
  return tr("{0}, {1} {2} {3}, {4}.{5} WIB", { 0: HARI[w.getUTCDay()], 1: w.getUTCDate(), 2: BULAN[w.getUTCMonth()], 3: w.getUTCFullYear(), 4: dua(w.getUTCHours()), 5: dua(w.getUTCMinutes()) })
}

/** Jam mulai parkir terdekat (kelipatan 15 menit ke depan) untuk tanggal WIB tertentu. */
export function slotParkir(tanggal, now = Date.now()) {
  const hariIni = tanggalWib(now) === tanggal
  const slot = []
  for (let m = 0; m < 24 * 60; m += 30) {
    const jam = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    const waktu = new Date(`${tanggal}T${jam}:00${kota.zonaWaktu.offset}`)
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
    tr('Dipesan lewat SmartMove Medan'),
  ]
  return baris.filter(Boolean).join('\n')
}

export async function bagikan(teks) {
  if (navigator.share) {
    try {
      await navigator.share({ title: tr('SmartMove Medan'), text: teks })
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

const dua = (n) => String(n).padStart(2, '0')
/** Sisa waktu bayar → "14:52" (di bawah 1 jam) atau "23 j 05 m". */
export function sisaWaktu(ms) {
  if (ms <= 0) return '00:00'
  const d = Math.floor(ms / 1000)
  const j = Math.floor(d / 3600)
  const m = Math.floor((d % 3600) / 60)
  const s = d % 60
  return j > 0 ? `${j} j ${dua(m)} m` : `${dua(m)}:${dua(s)}`
}
