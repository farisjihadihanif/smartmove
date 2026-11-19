import express from 'express';
import PointLedger from '../models/PointLedger.js';
import Redemption from '../models/Redemption.js';
import Voucher from '../models/Voucher.js';
import { requireAuth } from '../middleware/auth.js';
import { paginasi } from './admin/bantu.js';
import { entriPublik } from '../services/points.js';
import { filterVoucherBerlaku, redemptionPublik, tukarVoucher, voucherPublik } from '../services/rewards.js';

// Rewards (PRD §6.4, API_SPECS §2): saldo & riwayat poin, katalog voucher, tukar, voucher saya.
export function rewardsRouter() {
  const r = express.Router();

  // GET /rewards → { saldo, items (ledger, terbaru dulu), page, total }.
  r.get('/', requireAuth, async (req, res) => {
    const { page, limit, skip } = paginasi(req.query, { limit: 20, maks: 50 });
    const filter = { user: req.user._id };
    const [items, total] = await Promise.all([
      PointLedger.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      PointLedger.countDocuments(filter),
    ]);
    res.json({ saldo: req.user.poin, items: items.map(entriPublik), page, total });
  });

  // GET /rewards/vouchers → katalog voucher yang masih berlaku (termasuk yang stoknya habis).
  r.get('/vouchers', async (req, res) => {
    const items = await Voucher.find(filterVoucherBerlaku()).sort({ poin: 1, nama: 1 }).limit(100).lean();
    res.json({ items: items.map(voucherPublik) });
  });

  // POST /rewards/vouchers/:id/redeem → 201 { redemption, saldo }.
  r.post('/vouchers/:id/redeem', requireAuth, async (req, res) => {
    const { redemption, saldo } = await tukarVoucher(req.user._id, req.params.id);
    res.status(201).json({ redemption: redemptionPublik(redemption), saldo });
  });

  // GET /rewards/redemptions → voucher milik sendiri, terbaru dulu.
  r.get('/redemptions', requireAuth, async (req, res) => {
    const { page, limit, skip } = paginasi(req.query, { limit: 20, maks: 50 });
    const filter = { user: req.user._id };
    const [items, total] = await Promise.all([
      Redemption.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('voucher').lean(),
      Redemption.countDocuments(filter),
    ]);
    res.json({ items: items.map((x) => redemptionPublik(x)), page, total });
  });

  return r;
}
