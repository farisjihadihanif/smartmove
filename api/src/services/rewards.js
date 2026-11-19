import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Redemption from '../models/Redemption.js';
import User from '../models/User.js';
import Voucher from '../models/Voucher.js';
import { httpError } from '../lib/httpError.js';
import { POIN_UMPAN_BALIK, catatPoin, mingguWib } from './points.js';

// Rewards (PRD §6.4, TASK Keputusan #6 & #14, T-303): katalog voucher, tukar poin atomik.

/** Voucher yang masih bisa ditukar: aktif dan belum lewat masa berlaku. */
export const filterVoucherBerlaku = (now = new Date()) => ({
  aktif: true,
  $or: [{ berlakuSampai: null }, { berlakuSampai: { $exists: false } }, { berlakuSampai: { $gt: now } }],
});

export const voucherPublik = (v) => ({
  id: String(v._id),
  nama: v.nama,
  deskripsi: v.deskripsi || null,
  syarat: v.syarat || null,
  poin: v.poin,
  stok: v.stok,
  berlakuSampai: v.berlakuSampai ?? null,
  tersedia: v.stok > 0,
});

/** Redemption + voucher (hasil populate). Voucher lewat masa berlaku → `kedaluwarsa`. */
export function redemptionPublik(r, now = Date.now()) {
  const v = r.voucher && typeof r.voucher === 'object' && r.voucher.nama ? r.voucher : null;
  const lewat = v?.berlakuSampai && new Date(v.berlakuSampai).getTime() < now;
  return {
    id: String(r._id),
    kode: r.kode,
    status: r.status === 'aktif' && lewat ? 'kedaluwarsa' : r.status,
    voucher: v
      ? { id: String(v._id), nama: v.nama, deskripsi: v.deskripsi || null, syarat: v.syarat || null, poin: v.poin, berlakuSampai: v.berlakuSampai ?? null }
      : null,
    createdAt: r.createdAt,
  };
}

const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const buatKodeVoucher = () =>
  `SMV-${Array.from(crypto.randomBytes(8), (b, i) => (i === 4 ? '-' : '') + HURUF[b % HURUF.length]).join('')}`;

/**
 * Tukar poin dengan voucher, atomik dalam satu transaksi MongoDB (AGENTS aturan 3):
 * saldo cukup → stok dikurangi → poin dikurangi (PointLedger) → kode dibuat.
 * Poin kurang → 409 POIN_KURANG; stok habis → 409 STOK_HABIS. Gagal di tengah = tidak ada yang berubah.
 */
export async function tukarVoucher(userId, voucherId, now = new Date()) {
  if (!mongoose.isValidObjectId(voucherId)) throw httpError(404, 'Voucher tidak ditemukan');
  const session = await mongoose.startSession();
  try {
    let hasil;
    await session.withTransaction(async () => {
      const v = await Voucher.findOne({ _id: voucherId, ...filterVoucherBerlaku(now) }).session(session);
      if (!v) throw httpError(404, 'Voucher tidak ditemukan atau sudah tidak berlaku');
      const u = await User.findById(userId).session(session);
      if (!u || u.poin < v.poin) throw httpError(409, 'Poinmu belum cukup untuk voucher ini.', 'POIN_KURANG');

      const stok = await Voucher.updateOne({ _id: v._id, stok: { $gt: 0 } }, { $inc: { stok: -1 } }, { session });
      if (stok.modifiedCount !== 1) throw httpError(409, 'Stok voucher ini sudah habis.', 'STOK_HABIS');

      const _id = new mongoose.Types.ObjectId();
      const poin = await catatPoin({ user: userId, jumlah: -v.poin, alasan: 'tukar_voucher', ref: String(_id) }, { session });
      if (!poin || poin.kurang) throw httpError(409, 'Poinmu belum cukup untuk voucher ini.', 'POIN_KURANG');

      const [r] = await Redemption.create([{ _id, user: userId, voucher: v._id, kode: buatKodeVoucher() }], { session });
      r.voucher = v;
      hasil = { redemption: r, saldo: poin.saldo };
    });
    return hasil;
  } finally {
    await session.endSession();
  }
}

/**
 * Poin umpan balik (Keputusan #6 & #14): 5 poin, maks. 1× per minggu WIB (Senin–Minggu).
 * → jumlah poin yang diberikan (0 bila minggu ini sudah dapat).
 */
export async function beriPoinUmpanBalik(userId, now = Date.now()) {
  const hasil = await catatPoin({
    user: userId,
    jumlah: POIN_UMPAN_BALIK,
    alasan: 'umpan_balik',
    ref: `${userId}:${mingguWib(now)}`,
  });
  return hasil && !hasil.kurang ? POIN_UMPAN_BALIK : 0;
}
