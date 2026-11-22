import { tr } from './i18n.js'
// Cek ringan di klien, aturan sama dengan api/src/lib/validate.js (server tetap penentu).
export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function checkPassword(pw, label = tr('Password')) {
  if (!pw || pw.length < 8) return tr("{0} minimal 8 karakter.", { 0: label })
  if (pw.length > 72) return tr("{0} maksimal 72 karakter.", { 0: label })
  return null
}

/** Kembalikan pesan galat pertama, atau null bila data daftar sudah benar. */
export function checkRegister({ username, email, password }) {
  if (!USERNAME_RE.test(username)) return tr('Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.')
  if (!EMAIL_RE.test(email)) return tr('Format email belum benar.')
  return checkPassword(password)
}
