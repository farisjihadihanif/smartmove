import mongoose from 'mongoose';
import { ref } from './geo.js';

const redemptionSchema = new mongoose.Schema(
  {
    user: ref('User'),
    voucher: ref('Voucher'),
    kode: { type: String, required: true, unique: true },
    status: { type: String, enum: ['aktif', 'dipakai', 'kedaluwarsa'], default: 'aktif' },
  },
  { timestamps: true },
);

redemptionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Redemption || mongoose.model('Redemption', redemptionSchema);
