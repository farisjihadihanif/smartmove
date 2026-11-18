// Splash sambutan web tampil otomatis sekali per peramban untuk tamu baru; sesudahnya "/" langsung Beranda.
const KEY = 'smartmove:sambutan-dilihat'

export function welcomeSeen() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true // penyimpanan diblokir: jangan paksa Splash di setiap kunjungan
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* abaikan */
  }
}
