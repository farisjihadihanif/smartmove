import mongoose from 'mongoose';
import PointLedger from '../models/PointLedger.js';
import User from '../models/User.js';
import kota from '../cities/index.js';

// Poin hanya diubah di server dan selalu bersama entri PointLedger, dalam satu
// transaksi MongoDB (DATABASE §4.1). Index unik (alasan, ref) membuat pemberian poin
// idempoten: notifikasi Midtrans ganda tidak menambah poin dua kali.

export const POIN_PER_RUPIAH = 1 / 1000; // Keputusan #6: 1 poin per Rp1.000

export const poinPembayaran = (jumlah) => Math.floor(jumlah * POIN_PER_RUPIAH);
export const POIN_UMPAN_BALIK = 5; // Keputusan #6: maks. 1×/minggu

export const LABEL_ALASAN = {
  pembayaran: 'Pemesanan lunas',
  perjalanan: 'Perjalanan transportasi umum',
  umpan_balik: 'Umpan balik',
  tukar_voucher: 'Tukar voucher',
  admin: 'Penyesuaian admin',
};

export const entriPublik = (l) => ({
  id: String(l._id),
  jumlah: l.jumlah,
  alasan: l.alasan,
  label: LABEL_ALASAN[l.alasan] ?? l.alasan,
  ref: l.ref,
  createdAt: l.createdAt,
});

const WIB_MS = kota.zonaWaktu.offsetMs; // zona waktu kota aktif (Medan: WIB)
/**
 * Kunci minggu WIB (Senin–Minggu), mis. "2026-11-16" = Senin awal minggu.
 * Dipakai sebagai `ref` poin umpan balik: index unik (alasan, ref) menjamin
 * maks. 1×/minggu per pengguna walau permintaan datang bersamaan.
 */
export function mingguWib(now = Date.now()) {
  const w = new Date(new Date(now).getTime() + WIB_MS);
  const hari = (w.getUTCDay() + 6) % 7; // Senin = 0
  w.setUTCDate(w.getUTCDate() - hari);
  return w.toISOString().slice(0, 10);
}

const duplikat = (err) => err?.code === 11000;

/**
 * Tambah (atau kurangi, `jumlah` negatif) poin satu pengguna.
 * → `{ entri, saldo }`, atau `null` bila (alasan, ref) sudah pernah dicatat.
 * Saldo tidak boleh negatif: pengurangan yang melebihi saldo → `{ kurang: true }`.
 * `session` opsional: ikut transaksi pemanggil (mis. tukar voucher).
 */
export async function catatPoin({ user, jumlah, alasan, ref }, { session } = {}) {
  if (!Number.isInteger(jumlah) || jumlah === 0) return null;
  const jalan = async (s) => {
    const [entri] = await PointLedger.create([{ user, jumlah, alasan, ref }], { session: s });
    const filter = jumlah < 0 ? { _id: user, poin: { $gte: -jumlah } } : { _id: user };
    const u = await User.findOneAndUpdate(filter, { $inc: { poin: jumlah } }, { returnDocument: 'after', session: s });
    if (!u) {
      const err = new Error('POIN_KURANG');
      err.poinKurang = true;
      throw err;
    }
    return { entri, saldo: u.poin };
  };

  try {
    if (session) return await jalan(session);
    const s = await mongoose.startSession();
    try {
      let hasil;
      await s.withTransaction(async () => {
        hasil = await jalan(s);
      });
      return hasil;
    } finally {
      await s.endSession();
    }
  } catch (err) {
    if (duplikat(err)) return null;
    if (err.poinKurang) return { kurang: true };
    throw err;
  }
}
