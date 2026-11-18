import mongoose from 'mongoose';
import { ref } from './geo.js';

const pointLedgerSchema = new mongoose.Schema(
  {
    user: ref('User'),
    jumlah: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => Number.isInteger(v) && v !== 0,
        message: 'Jumlah poin harus bilangan bulat dan tidak nol',
      },
    },
    alasan: {
      type: String,
      enum: ['pembayaran', 'perjalanan', 'umpan_balik', 'tukar_voucher', 'admin'],
      required: true,
    },
    ref: { type: String, required: true }, // orderId / redemptionId / id lain
  },
  { timestamps: true },
);

pointLedgerSchema.index({ alasan: 1, ref: 1 }, { unique: true }); // idempoten
pointLedgerSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.PointLedger || mongoose.model('PointLedger', pointLedgerSchema);
