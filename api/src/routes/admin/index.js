import express from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { adminKontenRouter } from './konten.js';
import { adminPembayaranRouter } from './pembayaran.js';
import { adminPenggunaRouter } from './pengguna.js';
import { adminTransitRouter } from './transit.js';

// Dasbor admin (T-208, API_SPECS §2). Semua rute wajib peran admin.
export function adminRouter(cfg, { midtrans } = {}) {
  const r = express.Router();
  r.use(requireAuth, requireAdmin);
  r.use('/transit', adminTransitRouter(cfg));
  r.use(adminKontenRouter(cfg));
  r.use(adminPenggunaRouter(cfg));
  r.use(adminPembayaranRouter(cfg, { midtrans }));
  return r;
}
