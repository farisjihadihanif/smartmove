import mongoose from 'mongoose';
import { ref } from './geo.js';

export const PAYMENT_STATUS = ['menunggu', 'lunas', 'gagal', 'kedaluwarsa', 'dibatalkan'];

const paymentSchema = new mongoose.Schema(
  {
    user: ref('User'),
    orderId: { type: String, required: true, unique: true },
    layanan: {
      kode: { type: String, required: true },
      nama: { type: String, required: true },
    },
    jadwal: Date, // waktu berangkat / mulai parkir
    penumpang: { type: Number, min: 1, default: 1 }, // jumlah orang, atau jam untuk parkir
    jumlah: { type: Number, required: true, min: 1 }, // Rupiah bulat
    eTiket: { kode: String }, // simulasi – bukan tiket resmi
    // Hanya diubah oleh notifikasi Midtrans valid / cron (DATABASE §4.2).
    status: { type: String, enum: PAYMENT_STATUS, default: 'menunggu' },
    metode: String,
    snapToken: String,
    midtransRaw: { type: mongoose.Schema.Types.Mixed, select: false }, // tanpa data kartu
    dibayarPada: Date,
  },
  { timestamps: true },
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: 1 }); // cron kedaluwarsa

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
