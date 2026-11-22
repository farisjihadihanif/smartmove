// Traffic Mitigation Campaign (T-207). Samakan dengan mobile/lib/kampanye.dart.
import { hariWib, jamWib } from './wib.js'
import { tr } from './i18n.js'

export const JENIS_EVENT = {
  cfd: { label: tr('Car Free Day'), warna: '#2E9E5B' },
  rekayasa_arus: { label: tr('Rekayasa arus'), warna: '#FFA000' },
  acara: { label: tr('Acara'), warna: '#A2028A' },
  lainnya: { label: tr('Lainnya'), warna: '#41396F' },
}
export const infoJenisEvent = (j) => JENIS_EVENT[j] ?? JENIS_EVENT.lainnya

export const FITUR = [
  { value: 'navigasi', label: tr('Smart Navigation') },
  { value: 'lalu_lintas', label: tr('Live Traffic') },
  { value: 'trip_planner', label: tr('Trip Planner') },
  { value: 'pembayaran', label: tr('Digital Payment') },
  { value: 'rewards', label: tr('Rewards') },
  { value: 'kampanye', label: tr('Kampanye') },
  { value: 'lainnya', label: tr('Lainnya') },
]

export const LABEL_RATING = ['', tr('Kurang sekali'), tr('Kurang'), tr('Cukup'), tr('Bagus'), tr('Bagus sekali')]

/** "Hari ini, 06.00–10.00 WIB" atau "21 Nov, 06.00 – 22 Nov, 10.00 WIB". */
export function rentangEvent(e, now) {
  const hMulai = hariWib(e.mulai, now)
  const hSelesai = hariWib(e.selesai, now)
  if (hMulai === hSelesai) return tr("{0}, {1}–{2} WIB", { 0: hMulai, 1: jamWib(e.mulai), 2: jamWib(e.selesai) })
  return tr("{0}, {1} – {2}, {3} WIB", { 0: hMulai, 1: jamWib(e.mulai), 2: hSelesai, 3: jamWib(e.selesai) })
}

/** Cocokkan kata kunci ke judul/isi (tanpa beda huruf besar-kecil). */
export const cocok = (q, ...teks) => {
  const s = q.trim().toLowerCase()
  return !s || teks.some((t) => t?.toLowerCase().includes(s))
}
