import Feedback from '../models/Feedback.js';
import { httpError } from '../lib/httpError.js';

// Kampanye (PRD §6.5, T-206): bentuk publik konten & EventAlert, aturan umpan balik.

export const JENIS_KONTEN = ['tips', 'poster'];
export const FITUR_UMPAN_BALIK = ['navigasi', 'lalu_lintas', 'trip_planner', 'pembayaran', 'rewards', 'kampanye', 'lainnya'];
export const BATAS_UMPAN_BALIK_PER_HARI = 3; // anti-spam
export const JENDELA_EVENT_MS = 30 * 24 * 60 * 60 * 1000; // event mendatang ≤ 30 hari
export const MAKS_EVENT = 50;

const titik = (p) => (p?.coordinates?.length === 2 ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null);

export const kontenPublik = (c) => ({
  id: c.id ?? String(c._id),
  jenis: c.jenis,
  judul: c.judul,
  isi: c.isi ?? null,
  gambar: c.gambar ?? null,
  urutan: c.urutan ?? 0,
});

export const eventPublik = (e, now = Date.now()) => ({
  id: e.id ?? String(e._id),
  judul: e.judul,
  isi: e.isi,
  jenis: e.jenis,
  mulai: e.mulai,
  selesai: e.selesai,
  lokasi: titik(e.lokasi),
  status: new Date(e.mulai).getTime() <= now ? 'berlangsung' : 'mendatang',
});

export const umpanBalikPublik = (f) => ({
  id: f.id ?? String(f._id),
  rating: f.rating,
  komentar: f.komentar || null,
  fitur: f.fitur || null,
  createdAt: f.createdAt,
});

/** Validasi body POST /campaign/feedback. */
export function bacaUmpanBalik(b) {
  const { rating } = b;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw httpError(400, 'Rating harus bilangan bulat 1–5');
  }
  if (b.komentar !== undefined && b.komentar !== null && typeof b.komentar !== 'string') {
    throw httpError(400, 'Komentar harus berupa teks');
  }
  const komentar = (b.komentar ?? '').trim();
  if (komentar.length > 1000) throw httpError(400, 'Komentar maksimal 1000 karakter');
  const fitur = b.fitur ?? null;
  if (fitur !== null && !FITUR_UMPAN_BALIK.includes(fitur)) {
    throw httpError(400, `Fitur harus salah satu dari: ${FITUR_UMPAN_BALIK.join(', ')}`);
  }
  return { rating, komentar: komentar || undefined, fitur: fitur || undefined };
}

export async function kirimUmpanBalik(user, input, now = Date.now()) {
  const sejak = new Date(now - 24 * 60 * 60 * 1000);
  const jumlah = await Feedback.countDocuments({ user: user._id, createdAt: { $gt: sejak } });
  if (jumlah >= BATAS_UMPAN_BALIK_PER_HARI) {
    throw httpError(
      429,
      `Maksimal ${BATAS_UMPAN_BALIK_PER_HARI} umpan balik per hari. Terima kasih, coba lagi besok ya`,
      'BATAS_UMPAN_BALIK',
    );
  }
  return Feedback.create({ user: user._id, ...input });
}
