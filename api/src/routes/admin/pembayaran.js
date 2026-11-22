import express from 'express';
import BookableService from '../../models/BookableService.js';
import Payment from '../../models/Payment.js';
import Redemption from '../../models/Redemption.js';
import User from '../../models/User.js';
import Voucher from '../../models/Voucher.js';
import { httpError } from '../../lib/httpError.js';
import { JENIS_LAYANAN, layananPublik, pembayaranPublik, pemilikPembayaran } from '../../services/payments.js';
import { PAYMENT_STATUS } from '../../models/Payment.js';
import { voucherPublik } from '../../services/rewards.js';
import { bersih, bilangan, bool, paginasi, pilihan, teks, waktu, wajibId } from './bantu.js';

// Admin katalog pemesanan (`/admin/payment-services`, PRD §6.3 "dikelola admin"),
// voucher (`/admin/vouchers`, PRD §6.4) dan transaksi (`/admin/payments`, T-304).

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

  // ── Voucher ────────────────────────────────────────────────────────────────
  const voucherAdmin = (v, ditukar = 0) => ({
    ...voucherPublik(v),
    aktif: v.aktif !== false,
    ditukar,
    createdAt: v.createdAt,
  });

  function bacaVoucher(b, { baru }) {
    const data = bersih({
      nama: teks(b.nama, 'Nama', { wajib: baru, maks: 120 }),
      deskripsi: teks(b.deskripsi, 'Deskripsi', { maks: 500 }),
      syarat: teks(b.syarat, 'Syarat', { maks: 1000 }),
      poin: bilangan(b.poin, 'Poin', { min: 1, maks: 1_000_000, bulat: true }),
      stok: bilangan(b.stok, 'Stok', { min: 0, maks: 1_000_000, bulat: true }),
      berlakuSampai: b.berlakuSampai === null ? null : waktu(b.berlakuSampai, 'Masa berlaku'),
      aktif: bool(b.aktif, 'Aktif'),
    });
    if (baru && data.poin === undefined) throw httpError(400, 'Poin wajib diisi');
    if (baru && data.stok === undefined) throw httpError(400, 'Stok wajib diisi');
    return data;
  }

  async function jumlahDitukar(ids) {
    const rows = await Redemption.aggregate([{ $match: { voucher: { $in: ids } } }, { $group: { _id: '$voucher', n: { $sum: 1 } } }]);
    return new Map(rows.map((x) => [String(x._id), x.n]));
  }

  // GET /admin/vouchers?q=&aktif=&page
  r.get('/vouchers', async (req, res) => {
    const { page, limit, skip } = paginasi(req.query, { limit: 50 });
    const filter = {};
    if (req.query.aktif === 'true' || req.query.aktif === 'false') filter.aktif = req.query.aktif === 'true';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    if (q) filter.nama = { $regex: escRe(q), $options: 'i' };
    const [items, total] = await Promise.all([
      Voucher.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Voucher.countDocuments(filter),
    ]);
    const n = await jumlahDitukar(items.map((v) => v._id));
    res.json({ items: items.map((v) => voucherAdmin(v, n.get(String(v._id)) ?? 0)), page, total });
  });

  r.post('/vouchers', async (req, res) => {
    const v = await Voucher.create(bacaVoucher(req.body || {}, { baru: true }));
    res.status(201).json({ voucher: voucherAdmin(v) });
  });

  r.patch('/vouchers/:id', async (req, res) => {
    const v = await Voucher.findById(wajibId(req.params.id, 'Voucher'));
    if (!v) throw httpError(404, 'Voucher tidak ditemukan');
    v.set(bacaVoucher(req.body || {}, { baru: false }));
    await v.save();
    const n = await jumlahDitukar([v._id]);
    res.json({ voucher: voucherAdmin(v, n.get(String(v._id)) ?? 0) });
  });

  // Voucher yang sudah pernah ditukar tidak dihapus (kode milik pengguna tetap berlaku) → nonaktifkan.
  r.delete('/vouchers/:id', async (req, res) => {
    const id = wajibId(req.params.id, 'Voucher');
    if (await Redemption.exists({ voucher: id })) {
      throw httpError(409, 'Voucher ini sudah pernah ditukar. Nonaktifkan saja supaya tidak tampil di katalog.');
    }
    const v = await Voucher.findByIdAndDelete(id);
    if (!v) throw httpError(404, 'Voucher tidak ditemukan');
    res.status(204).end();
  });

  // ── Transaksi ──────────────────────────────────────────────────────────────
  // GET /admin/payments?status=&q=&page — q = orderId / nama layanan / username pemilik.
  r.get('/payments', async (req, res) => {
    const { page, limit, skip } = paginasi(req.query, { limit: 30 });
    const filter = {};
    if (req.query.status) filter.status = pilihan(req.query.status, 'Status', PAYMENT_STATUS);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    if (q) {
      const re = { $regex: escRe(q), $options: 'i' };
      const users = await User.find({ username: re }).select('_id').limit(50).lean();
      filter.$or = [{ orderId: re }, { 'layanan.nama': re }, { user: { $in: users.map((u) => u._id) } }];
    }
    const [items, total, ringkas] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'username').lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, jumlah: { $sum: '$jumlah' } } }]),
    ]);
    res.json({
      items: items.map((p) => ({ ...pembayaranPublik(p, req.bahasa), pengguna: pemilikPembayaran(p, req.bahasa) })),
      page,
      total,
      ringkasan: Object.fromEntries(ringkas.map((x) => [x._id, { jumlah: x.n, nilai: x.jumlah }])),
    });
  });

  return r;
}
