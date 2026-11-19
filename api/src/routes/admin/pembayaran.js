import express from 'express';
import BookableService from '../../models/BookableService.js';
import { httpError } from '../../lib/httpError.js';
import { JENIS_LAYANAN, layananPublik } from '../../services/payments.js';
import { bersih, bilangan, bool, paginasi, pilihan, teks, wajibId } from './bantu.js';

// Admin katalog pemesanan (`/admin/payment-services`, PRD §6.3 "dikelola admin").

const KODE_RE = /^[A-Z0-9-]{2,30}$/;
const JAM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const layananAdmin = (s) => ({
  id: String(s._id),
  ...layananPublik(s),
  aktif: s.aktif !== false,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

function bacaJadwal(v) {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > 48 || v.some((j) => typeof j !== 'string' || !JAM_RE.test(j))) {
    throw httpError(400, 'Jadwal harus berupa daftar jam "HH:mm" (maks. 48)');
  }
  return [...new Set(v)].sort();
}

function bacaLayanan(b, { baru }) {
  const data = bersih({
    jenis: pilihan(b.jenis, 'Jenis', JENIS_LAYANAN),
    nama: teks(b.nama, 'Nama', { wajib: baru, maks: 120 }),
    operator: teks(b.operator, 'Operator', { maks: 80 }),
    asal: teks(b.asal, 'Asal', { maks: 120 }),
    tujuan: teks(b.tujuan, 'Tujuan', { maks: 120 }),
    harga: bilangan(b.harga, 'Harga', { min: 1, maks: 10_000_000, bulat: true }),
    jadwal: bacaJadwal(b.jadwal),
    aktif: bool(b.aktif, 'Aktif'),
  });
  if (baru) {
    if (!data.jenis) throw httpError(400, 'Jenis wajib diisi');
    if (data.harga === undefined) throw httpError(400, 'Harga wajib diisi');
    const kode = teks(b.kode, 'Kode', { wajib: true, maks: 30 }).toUpperCase();
    if (!KODE_RE.test(kode)) throw httpError(400, 'Kode 2–30 karakter: huruf, angka, atau tanda hubung');
    data.kode = kode;
  }
  return data;
}

export function adminPembayaranRouter() {
  const r = express.Router();

  // GET /admin/payment-services?q=&jenis=&page
  r.get('/payment-services', async (req, res) => {
    const { page, limit, skip } = paginasi(req.query, { limit: 50 });
    const filter = {};
    if (req.query.jenis) filter.jenis = pilihan(req.query.jenis, 'Jenis', JENIS_LAYANAN);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    if (q) {
      const re = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      filter.$or = [{ kode: re }, { nama: re }, { operator: re }, { asal: re }, { tujuan: re }];
    }
    const [items, total] = await Promise.all([
      BookableService.find(filter).sort({ jenis: 1, nama: 1 }).skip(skip).limit(limit).lean(),
      BookableService.countDocuments(filter),
    ]);
    res.json({ items: items.map(layananAdmin), page, total });
  });

  r.post('/payment-services', async (req, res) => {
    const data = bacaLayanan(req.body || {}, { baru: true });
    if (await BookableService.exists({ kode: data.kode })) throw httpError(409, 'Kode layanan sudah dipakai');
    const s = await BookableService.create(data);
    res.status(201).json({ service: layananAdmin(s) });
  });

  r.patch('/payment-services/:id', async (req, res) => {
    const s = await BookableService.findById(wajibId(req.params.id, 'Layanan'));
    if (!s) throw httpError(404, 'Layanan tidak ditemukan');
    s.set(bacaLayanan(req.body || {}, { baru: false }));
    await s.save();
    res.json({ service: layananAdmin(s) });
  });

  // Hapus aman: transaksi lama menyimpan salinan data layanan sendiri.
  r.delete('/payment-services/:id', async (req, res) => {
    const s = await BookableService.findByIdAndDelete(wajibId(req.params.id, 'Layanan'));
    if (!s) throw httpError(404, 'Layanan tidak ditemukan');
    res.status(204).end();
  });

  return r;
}
