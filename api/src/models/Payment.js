import mongoose from 'mongoose';
import { ref } from './geo.js';

export const PAYMENT_STATUS = ['menunggu', 'lunas', 'gagal', 'kedaluwarsa', 'dibatalkan'];

const paymentSchema = new mongoose.Schema(
  {
    // Kosong bila akun pemiliknya dihapus admin: transaksi tetap disimpan, dianonimkan
    // (`penggunaDihapus: true`, tampil "Pengguna dihapus") agar riwayat transaksi utuh.
    user: ref('User', false),
    penggunaDihapus: { type: Boolean, default: false },
    orderId: { type: String, required: true, unique: true },
    // Salinan data layanan saat dipesan (e-tiket tetap utuh walau katalog diubah admin).
    layanan: {
      kode: { type: String, required: true },
      nama: { type: String, required: true },
      jenis: String,
      operator: String,
      asal: String,
      tujuan: String,
      harga: Number,
    },
    jadwal: Date, // waktu berangkat / mulai parkir
    penumpang: { type: Number, min: 1, default: 1 }, // jumlah orang, atau jam untuk parkir
    jumlah: { type: Number, required: true, min: 1 }, // Rupiah bulat
    eTiket: { kode: String }, // simulasi – bukan tiket resmi
    // Hanya diubah oleh notifikasi Midtrans valid / cron (DATABASE §4.2).
    status: { type: String, enum: PAYMENT_STATUS, default: 'menunggu' },
    metode: String,
    // Instruksi bayar dari Midtrans Core API (TASK Keputusan #19): grup qris|va|ewallet,
    // qrString/qrUrl, deeplink e-wallet, bank + nomorVa, kodePerusahaan/kodeBayar (Mandiri).
    instruksi: { type: mongoose.Schema.Types.Mixed },
    batasBayar: Date, // expiry_time Midtrans
    midtransRaw: { type: mongoose.Schema.Types.Mixed, select: false }, // tanpa data kartu
    dibayarPada: Date,
  },
  { timestamps: true },
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: 1 }); // cron kedaluwarsa

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
