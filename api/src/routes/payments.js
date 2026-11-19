import express from 'express';
import { rateLimit } from 'express-rate-limit';
import BookableService from '../models/BookableService.js';
import Payment from '../models/Payment.js';
import { httpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import { paginasi } from './admin/bantu.js';
import {
  JENIS_LAYANAN,
  bacaPesanan,
  buatPembayaran,
  layananPublik,
  pembayaranPublik,
  terapkanNotifikasi,
  wib,
} from '../services/payments.js';

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mirip = (v) => ({ $regex: escape(v.trim().slice(0, 80)), $options: 'i' });

// Pemesanan & Digital Payment (simulasi) — PRD §6.3, API_SPECS §2 & §6.4.
export function paymentsRouter(cfg, { midtrans }) {
  const r = express.Router();
  // Membuat transaksi & cek status memanggil Midtrans: dibatasi per pengguna/IP.
  const batasMidtrans = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: cfg.paymentRateLimit?.limit ?? 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => (req.user ? `u:${req.user.id}` : `ip:${req.ip}`),
    validate: { keyGeneratorIpFallback: false },
    message: { message: 'Terlalu banyak permintaan pembayaran, coba lagi nanti' },
  });

  // GET /payments/services?asal=&tujuan=&jenis=&tanggal=YYYY-MM-DD (WIB, bawaan hari ini).
  r.get('/services', async (req, res) => {
    const { asal, tujuan, jenis } = req.query;
    const now = Date.now();
    const tanggal = typeof req.query.tanggal === 'string' && req.query.tanggal ? req.query.tanggal : wib(now).tanggal;
    if (!TANGGAL_RE.test(tanggal) || Number.isNaN(new Date(`${tanggal}T00:00:00+07:00`).getTime())) {
      throw httpError(400, 'Tanggal harus berformat YYYY-MM-DD');
    }
    if (jenis !== undefined && !JENIS_LAYANAN.includes(jenis)) {
      throw httpError(400, `Jenis harus salah satu dari: ${JENIS_LAYANAN.join(', ')}`);
    }
    const filter = { aktif: true };
    if (jenis) filter.jenis = jenis;
    if (typeof asal === 'string' && asal.trim()) filter.asal = mirip(asal);
    if (typeof tujuan === 'string' && tujuan.trim()) filter.tujuan = mirip(tujuan);
    const items = await BookableService.find(filter).sort({ jenis: 1, nama: 1 }).limit(100).lean();
    res.json({ items: items.map((s) => layananPublik(s, { tanggal, now })), tanggal });
  });

  // POST /payments/notification — webhook Midtrans (tanpa login; keabsahan dari signature_key).
  r.post('/notification', async (req, res) => {
    await terapkanNotifikasi(req.body || {}, { serverKey: midtrans.serverKey });
    res.json({ ok: true });
  });

  // POST /payments → { orderId, snapToken, redirectUrl, payment }.
  r.post('/', requireAuth, batasMidtrans, async (req, res) => {
    const pesanan = await bacaPesanan(req.body || {});
    const p = await buatPembayaran(req.user, pesanan, { midtrans, appUrl: cfg.appUrl });
    res.status(201).json({
      orderId: p.orderId,
      snapToken: p.snapToken,
      redirectUrl: p.redirectUrl,
      payment: pembayaranPublik(p),
    });
  });

  // GET /payments → riwayat milik sendiri, terbaru dulu.
  r.get('/', requireAuth, async (req, res) => {
    const { page, limit, skip } = paginasi(req.query, { limit: 20, maks: 50 });
    const filter = { user: req.user._id };
    const [items, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(filter),
    ]);
    res.json({ items: items.map(pembayaranPublik), page, total });
  });

  async function milikSendiri(req) {
    const p = await Payment.findOne({ orderId: String(req.params.orderId), user: req.user._id });
    if (!p) throw httpError(404, 'Transaksi tidak ditemukan');
    return p;
  }

  // GET /payments/:orderId → status & bukti (e-tiket simulasi bila lunas).
  r.get('/:orderId', requireAuth, async (req, res) => {
    res.json({ payment: pembayaranPublik(await milikSendiri(req)) });
  });

  // POST /payments/:orderId/cek — tombol "Cek status" (DESIGN §5). Server menanyakan status ke
  // Midtrans; jawabannya bertanda tangan dan diproses sama persis seperti webhook.
  r.post('/:orderId/cek', requireAuth, batasMidtrans, async (req, res) => {
    let p = await milikSendiri(req);
    if (p.status === 'menunggu') {
      const st = await midtrans.cekStatus(p.orderId);
      if (st) p = (await terapkanNotifikasi(st, { serverKey: midtrans.serverKey })).payment;
    }
    res.json({ payment: pembayaranPublik(p) });
  });

  return r;
}
