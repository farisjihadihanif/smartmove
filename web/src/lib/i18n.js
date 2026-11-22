// Dua bahasa (T-111, TASK Keputusan #20): Indonesia (bawaan) + Inggris.
// Kunci terjemahan = teks Indonesia apa adanya; teks yang belum diterjemahkan tampil dalam
// bahasa Indonesia. Terjemahan Inggris di src/i18n/en.json.
// Pilihan disimpan per perangkat; berganti bahasa memuat ulang halaman supaya semua teks
// (termasuk konstanta modul) ikut berganti.
import en from '../i18n/en.json'

export const KUNCI_BAHASA = 'smartmove-bahasa'
const KAMUS = { en }

export function bacaPilihanBahasa() {
  try {
    const v = localStorage.getItem(KUNCI_BAHASA)
    return v === 'id' || v === 'en' ? v : 'sistem'
  } catch {
    return 'sistem'
  }
}

/** Bahasa perangkat: Indonesia bila salah satu bahasa pilihan browser `id`, selain itu Inggris. */
export function bahasaPerangkat() {
  if (typeof navigator === 'undefined') return 'id'
  const daftar = navigator.languages?.length ? navigator.languages : [navigator.language || 'id']
  const pertama = daftar.find((l) => /^(id|en)\b/i.test(l)) ?? daftar[0] ?? 'id'
  return /^id\b|^in\b/i.test(pertama) ? 'id' : 'en'
}

export const bahasaDari = (pilihan) => (pilihan === 'id' || pilihan === 'en' ? pilihan : bahasaPerangkat())

/** Bahasa aktif halaman ini ('id' | 'en'). */
export const bahasa = bahasaDari(bacaPilihanBahasa())
/** Locale untuk Intl (tanggal, angka, mata uang). */
export const locale = bahasa === 'en' ? 'en-US' : 'id-ID'

if (typeof document !== 'undefined') document.documentElement.lang = bahasa

/**
 * Terjemahkan teks UI. `vars` mengisi `{nama}` di dalam teks:
 * tr('Sisa {n} kursi', { n: 3 }).
 */
export function tr(teks, vars) {
  let s = bahasa === 'id' ? teks : (KAMUS[bahasa]?.[teks] ?? teks)
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
  return s
}

export const PILIHAN_BAHASA = [
  { value: 'sistem', label: tr('Ikuti perangkat') },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
]

export function simpanPilihanBahasa(v) {
  try {
    if (v === 'sistem') localStorage.removeItem(KUNCI_BAHASA)
    else localStorage.setItem(KUNCI_BAHASA, v)
  } catch {
    // Penyimpanan diblokir: tetap di bahasa sekarang.
  }
  if (bahasaDari(v) !== bahasa) window.location.reload()
}

/** Format angka sesuai bahasa: 1.234 (id) / 1,234 (en). */
export const angka = (n, opsi) => Number(n).toLocaleString(locale, opsi)
