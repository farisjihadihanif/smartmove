import express from 'express';
import Content from '../../models/Content.js';
import Event from '../../models/Event.js';
import Feedback from '../../models/Feedback.js';
import Payment from '../../models/Payment.js';
import PointLedger from '../../models/PointLedger.js';
import Redemption from '../../models/Redemption.js';
import RoadCorridor from '../../models/RoadCorridor.js';
import TrafficReport from '../../models/TrafficReport.js';
import TransitLine from '../../models/TransitLine.js';
import Trip from '../../models/Trip.js';
import User from '../../models/User.js';
import { httpError } from '../../lib/httpError.js';
import { hapusBerkas } from '../../services/berkas.js';
import { publicLaporan } from '../../services/trafficReports.js';
import { umpanBalikPublik } from '../../services/campaign.js';
import { golonganTarif } from '../../services/tarif.js';
import { paginasi, pilihan, wajibId } from './bantu.js';

// Admin: statistik, pengguna, moderasi laporan lalu lintas & umpan balik (T-208).

const HARI_MS = 24 * 60 * 60 * 1000;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const penggunaAdmin = (u) => ({
  id: String(u._id),
  username: u.username,
  email: u.email,
  namaLengkap: u.namaLengkap ?? null,
  role: u.role,
  createdAt: u.createdAt,
});

const pelapor = (u) => (u ? { id: String(u._id), username: u.username } : null);

export function adminPenggunaRouter() {
  const r = express.Router();

  r.get('/stats', async (req, res) => {
    const now = new Date();
    const [pengguna, baru7Hari, admin, laporanAktif, rating, eventAktif, trip, koridor, jalan] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: new Date(now - 7 * HARI_MS) } }),
      User.countDocuments({ role: 'admin' }),
      TrafficReport.countDocuments({ expiresAt: { $gt: now } }),
      Feedback.aggregate([{ $group: { _id: null, total: { $sum: 1 }, rata: { $avg: '$rating' } } }]),
      Event.countDocuments({ selesai: { $gte: now } }),
      Trip.countDocuments(),
      TransitLine.find({}, 'kode nama jenis operator tarifSumber aktif').lean(),
      RoadCorridor.find({}, 'dikoreksiAdmin aktif').lean(),
    ]);
    const aktif = koridor.filter((l) => l.aktif !== false);
    res.json({
      pengguna: { total: pengguna, baru7Hari, admin },
      laporanAktif,
      umpanBalik: { total: rating[0]?.total ?? 0, rataRating: rating[0] ? Math.round(rating[0].rata * 10) / 10 : null },
      eventAktif,
      trip,
      koridorTransit: {
        total: koridor.length,
        aktif: aktif.length,
        tarifBelumAdmin: aktif.filter((l) => l.jenis !== 'kereta' && l.tarifSumber !== 'admin').length,
        periksaJenis: aktif.filter((l) => l.jenis === 'angkot' && golonganTarif(l) === 'bus_listrik').length,
      },
      jalanUtama: {
        total: jalan.length,
        dikoreksi: jalan.filter((k) => k.dikoreksiAdmin).length,
        disembunyikan: jalan.filter((k) => k.aktif === false).length,
      },
      konten: await Content.countDocuments({ aktif: true }),
    });
  });

  // ── Pengguna ──
  r.get('/users', async (req, res) => {
    const { page, limit, skip } = paginasi(req.query);
    const f = {};
    if (req.query.role) f.role = pilihan(req.query.role, 'Peran', ['user', 'admin']);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      const re = new RegExp(escRe(q), 'i');
      f.$or = [{ username: re }, { email: re }, { namaLengkap: re }];
    }
    const [items, total] = await Promise.all([
      User.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(f),
    ]);
    res.json({ items: items.map(penggunaAdmin), page, total });
  });

  // PATCH /admin/users/:id { role } — tidak bisa mengubah peran sendiri.
  r.patch('/users/:id', async (req, res) => {
    const id = wajibId(req.params.id, 'Pengguna');
    const role = pilihan(req.body?.role, 'Peran', ['user', 'admin']);
    if (!role) throw httpError(400, 'Peran wajib diisi');
    if (String(req.user._id) === id) throw httpError(400, 'Kamu tidak bisa mengubah peranmu sendiri');
    const u = await User.findById(id);
    if (!u) throw httpError(404, 'Pengguna tidak ditemukan');
    u.role = role;
    if (role === 'user') u.tokenVersion += 1; // cabut sesi yang masih membawa hak admin
    await u.save();
    res.json({ user: penggunaAdmin(u.toObject()) });
  });

  // DELETE /admin/users/:id — hapus akun beserta data pribadinya (trip, laporan, umpan balik,
  // poin, voucher). Pembayaran simulasi tetap disimpan tapi dianonimkan (tanpa `user`,
  // `penggunaDihapus: true`) supaya riwayat transaksi admin utuh.
  r.delete('/users/:id', async (req, res) => {
    const id = wajibId(req.params.id, 'Pengguna');
    if (String(req.user._id) === id) throw httpError(400, 'Kamu tidak bisa menghapus akunmu sendiri');
    const u = await User.findById(id);
    if (!u) throw httpError(404, 'Pengguna tidak ditemukan');
    await Promise.all([
      Trip.deleteMany({ user: u._id }),
      Feedback.deleteMany({ user: u._id }),
      TrafficReport.deleteMany({ user: u._id }),
      TrafficReport.updateMany({ 'konfirmasiOleh.user': u._id }, { $pull: { konfirmasiOleh: { user: u._id } } }),
      PointLedger.deleteMany({ user: u._id }),
      Redemption.deleteMany({ user: u._id }),
      Payment.updateMany({ user: u._id }, { $unset: { user: 1 }, $set: { penggunaDihapus: true } }),
    ]);
    await u.deleteOne();
    if (u.foto) await hapusBerkas(u.foto).catch(() => {});
    res.status(204).end();
  });

  // ── Moderasi laporan lalu lintas ──
  // GET /admin/traffic/reports?status=aktif|semua&page=
  r.get('/traffic/reports', async (req, res) => {
    const { page, limit, skip } = paginasi(req.query);
    const f = req.query.status === 'semua' ? {} : { expiresAt: { $gt: new Date() } };
    const [items, total] = await Promise.all([
      TrafficReport.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'username').lean(),
      TrafficReport.countDocuments(f),
    ]);
    res.json({ items: items.map((x) => ({ ...publicLaporan(x), pelapor: pelapor(x.user) })), page, total });
  });

  r.get('/traffic/reports/:id', async (req, res) => {
    const x = await TrafficReport.findById(wajibId(req.params.id, 'Laporan')).populate('user', 'username').lean();
    if (!x) throw httpError(404, 'Laporan tidak ditemukan');
    res.json({ laporan: { ...publicLaporan(x), pelapor: pelapor(x.user) } });
  });

  r.delete('/traffic/reports/:id', async (req, res) => {
    const x = await TrafficReport.findByIdAndDelete(wajibId(req.params.id, 'Laporan'));
    if (!x) throw httpError(404, 'Laporan tidak ditemukan');
    res.status(204).end();
  });

  // ── Umpan balik ──
  // GET /admin/feedback?rating=1..5&page=
  r.get('/feedback', async (req, res) => {
    const { page, limit, skip } = paginasi(req.query);
    const f = {};
    if (req.query.rating) {
      const n = Number(req.query.rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) throw httpError(400, 'Rating harus 1–5');
      f.rating = n;
    }
    const [items, total] = await Promise.all([
      Feedback.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'username').lean(),
      Feedback.countDocuments(f),
    ]);
    res.json({ items: items.map((x) => ({ ...umpanBalikPublik(x), pengguna: pelapor(x.user) })), page, total });
  });

  r.delete('/feedback/:id', async (req, res) => {
    const x = await Feedback.findByIdAndDelete(wajibId(req.params.id, 'Umpan balik'));
    if (!x) throw httpError(404, 'Umpan balik tidak ditemukan');
    res.status(204).end();
  });

  return r;
}
