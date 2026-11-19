// Traffic Mitigation Campaign (T-207). Samakan dengan mobile/lib/kampanye.dart.
import { hariWib, jamWib } from './wib.js'

export const JENIS_EVENT = {
  cfd: { label: 'Car Free Day', warna: '#2E9E5B' },
  rekayasa_arus: { label: 'Rekayasa arus', warna: '#FFA000' },
  acara: { label: 'Acara', warna: '#A2028A' },
  lainnya: { label: 'Lainnya', warna: '#41396F' },
}
export const infoJenisEvent = (j) => JENIS_EVENT[j] ?? JENIS_EVENT.lainnya

export const FITUR = [
  { value: 'navigasi', label: 'Smart Navigation' },
  { value: 'lalu_lintas', label: 'Live Traffic' },
  { value: 'trip_planner', label: 'Trip Planner' },
  { value: 'pembayaran', label: 'Digital Payment' },
  { value: 'rewards', label: 'Rewards' },
  { value: 'kampanye', label: 'Kampanye' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const LABEL_RATING = ['', 'Kurang sekali', 'Kurang', 'Cukup', 'Bagus', 'Bagus sekali']

/** "Hari ini, 06.00–10.00 WIB" atau "21 Nov, 06.00 – 22 Nov, 10.00 WIB". */
export function rentangEvent(e, now) {
  const hMulai = hariWib(e.mulai, now)
  const hSelesai = hariWib(e.selesai, now)
  if (hMulai === hSelesai) return `${hMulai}, ${jamWib(e.mulai)}–${jamWib(e.selesai)} WIB`
  return `${hMulai}, ${jamWib(e.mulai)} – ${hSelesai}, ${jamWib(e.selesai)} WIB`
}

/** Cocokkan kata kunci ke judul/isi (tanpa beda huruf besar-kecil). */
export const cocok = (q, ...teks) => {
  const s = q.trim().toLowerCase()
  return !s || teks.some((t) => t?.toLowerCase().includes(s))
}
