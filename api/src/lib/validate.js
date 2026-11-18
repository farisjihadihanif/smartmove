import { httpError } from './httpError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

export const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function checkUsername(v) {
  const u = str(v).toLowerCase();
  if (!USERNAME_RE.test(u)) {
    throw httpError(400, 'Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah');
  }
  return u;
}

export function checkEmail(v) {
  const e = str(v).toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 254) throw httpError(400, 'Format email tidak valid');
  return e;
}

export function checkPassword(v, label = 'Password') {
  if (typeof v !== 'string' || v.length < 8) throw httpError(400, `${label} minimal 8 karakter`);
  if (v.length > 72) throw httpError(400, `${label} maksimal 72 karakter`); // batas bcrypt
  return v;
}
