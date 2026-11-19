// Waktu Medan (WIB, UTC+7, tanpa musim panas). Jam server dari GET /home → `waktuServer`.
const WIB_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const dua = (n) => String(n).padStart(2, '0')

const shift = (t) => new Date(new Date(t).getTime() + WIB_MS)
const wibDay = (t) => Math.floor((new Date(t).getTime() + WIB_MS) / DAY_MS)

/** "07.30" */
export function jamWib(t) {
  const w = shift(t)
  return `${dua(w.getUTCHours())}.${dua(w.getUTCMinutes())}`
}

/** Sama dengan API (home.js): pagi 04–10, siang 11–14, sore 15–17, malam 18–03. */
export function salamWib(t) {
  const h = shift(t).getUTCHours()
  if (h >= 4 && h < 11) return 'Selamat pagi'
  if (h >= 11 && h < 15) return 'Selamat siang'
  if (h >= 15 && h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** "Hari ini" / "Besok" / "Kemarin" / "21 Nov" relatif terhadap `now`. */
export function hariWib(t, now) {
  const d = wibDay(t) - wibDay(now)
  if (d === 0) return 'Hari ini'
  if (d === 1) return 'Besok'
  if (d === -1) return 'Kemarin'
  const w = shift(t)
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]}`
}

/** Jam, ditambah tanggal bila bukan hari yang sama dengan `now`: "11.00" / "21 Nov, 11.00". */
export function jamAtauTanggal(t, now) {
  if (wibDay(t) === wibDay(now)) return jamWib(t)
  return `${hariWib(t, now)}, ${jamWib(t)}`
}

/** Untuk kejadian lampau: "Baru saja", "15 menit lalu", "3 jam lalu", lalu tanggal. */
export function sejak(t, now) {
  const m = Math.floor((new Date(now) - new Date(t)) / 60000)
  if (m < 1) return 'Baru saja'
  if (m < 60) return `${m} menit lalu`
  if (m < 24 * 60) return `${Math.floor(m / 60)} jam lalu`
  return hariWib(t, now)
}

/** ISO → nilai <input type="datetime-local"> dalam WIB ("2026-11-20T06:00"). */
export const keInputWib = (iso) => (iso ? new Date(new Date(iso).getTime() + WIB_MS).toISOString().slice(0, 16) : '')

/** Nilai <input type="datetime-local"> (dibaca sebagai WIB) → ISO. */
export const dariInputWib = (v) => (v ? new Date(`${v}:00+07:00`).toISOString() : null)
