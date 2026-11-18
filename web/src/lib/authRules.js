// Cek ringan di klien, aturan sama dengan api/src/lib/validate.js (server tetap penentu).
export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function checkPassword(pw, label = 'Password') {
  if (!pw || pw.length < 8) return `${label} minimal 8 karakter.`
  if (pw.length > 72) return `${label} maksimal 72 karakter.`
  return null
}

/** Kembalikan pesan galat pertama, atau null bila data daftar sudah benar. */
export function checkRegister({ username, email, password }) {
  if (!USERNAME_RE.test(username)) return 'Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.'
  if (!EMAIL_RE.test(email)) return 'Format email belum benar.'
  return checkPassword(password)
}
