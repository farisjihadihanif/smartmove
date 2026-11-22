// Mode gelap (T-110): pilihan Sistem / Terang / Gelap, disimpan per perangkat (localStorage).
// `data-theme="dark|light"` dipasang di <html>; index.html memasangnya lebih dulu (tanpa kedip).
import { useEffect, useState, useSyncExternalStore } from 'react'
import { tr } from './i18n.js'

export const KUNCI_TEMA = 'smartmove-tema'
export const PILIHAN_TEMA = [
  { value: 'sistem', label: tr('Ikuti sistem') },
  { value: 'terang', label: tr('Terang') },
  { value: 'gelap', label: tr('Gelap') },
]

const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)

export function bacaPilihan() {
  try {
    const v = localStorage.getItem(KUNCI_TEMA)
    return v === 'terang' || v === 'gelap' ? v : 'sistem'
  } catch {
    return 'sistem'
  }
}

/** Pilihan → 'dark' | 'light' (Sistem mengikuti prefers-color-scheme). */
export const temaAktif = (pilihan, sistemGelap = media()?.matches ?? false) =>
  pilihan === 'gelap' || (pilihan === 'sistem' && sistemGelap) ? 'dark' : 'light'

export function pasangTema(pilihan = bacaPilihan()) {
  const t = temaAktif(pilihan)
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#15101E' : '#361254')
  return t
}

const pendengar = new Set()
function langganan(fn) {
  pendengar.add(fn)
  return () => pendengar.delete(fn)
}

/** Pasang sekali saat aplikasi mulai: ikuti perubahan setelan sistem. */
export function mulaiTema() {
  pasangTema()
  media()?.addEventListener?.('change', () => {
    if (bacaPilihan() === 'sistem') pasangTema('sistem')
    pendengar.forEach((fn) => fn())
  })
}

export function simpanPilihan(v) {
  try {
    if (v === 'sistem') localStorage.removeItem(KUNCI_TEMA)
    else localStorage.setItem(KUNCI_TEMA, v)
  } catch {
    // Penyimpanan diblokir: pilihan berlaku sampai halaman ditutup.
  }
  pasangTema(v)
  pendengar.forEach((fn) => fn())
}

/** [pilihan, setPilihan, temaAktif] */
export function useTema() {
  const pilihan = useSyncExternalStore(langganan, bacaPilihan, () => 'sistem')
  const [aktif, setAktif] = useState(() => (typeof document !== 'undefined' ? document.documentElement.dataset.theme ?? 'light' : 'light'))
  useEffect(() => langganan(() => setAktif(document.documentElement.dataset.theme ?? 'light')), [])
  return [pilihan, simpanPilihan, aktif]
}
