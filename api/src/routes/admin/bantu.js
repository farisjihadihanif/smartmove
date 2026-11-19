import mongoose from 'mongoose';
import { httpError } from '../../lib/httpError.js';
import { str } from '../../lib/validate.js';
import { wajibDalamWilayah } from '../../lib/wilayah.js';

// Pembantu validasi untuk rute admin (T-208).

const angka = (v) => typeof v === 'number' && Number.isFinite(v);

/** ?page=1&limit=20 → { page, limit, skip } (API_SPECS §3). */
export function paginasi(q, { limit: bawaan = 20, maks = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
  const limit = Math.min(maks, Math.max(1, Number.parseInt(q.limit, 10) || bawaan));
  return { page, limit, skip: (page - 1) * limit };
}

/** :id harus ObjectId; selain itu 404 seperti data tidak ada. */
export function wajibId(id, label = 'Data') {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, `${label} tidak ditemukan`);
  return id;
}

/** Teks wajib/opsional dengan batas panjang. `undefined` = tidak diubah. */
export function teks(v, label, { wajib = false, maks = 200 } = {}) {
  if (v === undefined) {
    if (wajib) throw httpError(400, `${label} wajib diisi`);
    return undefined;
  }
  if (v !== null && typeof v !== 'string') throw httpError(400, `${label} harus berupa teks`);
  const s = str(v ?? '');
  if (wajib && !s) throw httpError(400, `${label} wajib diisi`);
  if (s.length > maks) throw httpError(400, `${label} maksimal ${maks} karakter`);
  return s;
}

/** {lat, lng} di wilayah Mebidang → GeoJSON Point. `null` → null (hapus lokasi). */
export function titik(v, label = 'Lokasi') {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const { lat, lng } = v || {};
  if (!angka(lat) || !angka(lng)) throw httpError(400, `${label} harus berupa {lat, lng}`);
  wajibDalamWilayah({ lat, lng });
  return { type: 'Point', coordinates: [lng, lat] };
}

/** [[lng, lat], …] minimal 2 titik di wilayah → GeoJSON LineString. */
export function garis(v, label = 'Garis') {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length < 2) throw httpError(400, `${label} minimal 2 titik [lng, lat]`);
  if (v.length > 5000) throw httpError(400, `${label} maksimal 5000 titik`);
  const coordinates = v.map((p) => {
    if (!Array.isArray(p) || p.length !== 2 || !angka(p[0]) || !angka(p[1])) {
      throw httpError(400, `${label} harus berupa daftar [lng, lat]`);
    }
    wajibDalamWilayah({ lat: p[1], lng: p[0] });
    return [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6];
  });
  return { type: 'LineString', coordinates };
}

export function bool(v, label) {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw httpError(400, `${label} harus true/false`);
  return v;
}

export function bilangan(v, label, { min = 0, maks = Infinity, bulat = false, bolehNull = false } = {}) {
  if (v === undefined) return undefined;
  if (v === null && bolehNull) return null;
  if (!angka(v) || v < min || v > maks || (bulat && !Number.isInteger(v))) {
    throw httpError(400, `${label} harus angka ${bulat ? 'bulat ' : ''}${min}–${maks === Infinity ? '…' : maks}`);
  }
  return v;
}

export function pilihan(v, label, daftar) {
  if (v === undefined) return undefined;
  if (!daftar.includes(v)) throw httpError(400, `${label} harus salah satu dari: ${daftar.join(', ')}`);
  return v;
}

export function waktu(v, label) {
  if (v === undefined) return undefined;
  const d = typeof v === 'string' ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) throw httpError(400, `${label} tidak valid`);
  return d;
}

/** Hapus kunci bernilai `undefined` (field yang tidak dikirim). */
export const bersih = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export const keTitik = (p) => (p?.coordinates?.length === 2 ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null);
