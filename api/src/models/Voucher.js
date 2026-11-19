import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, trim: true },
    deskripsi: { type: String, trim: true },
    syarat: { type: String, trim: true }, // syarat & ketentuan singkat (PRD §6.4)
    poin: { type: Number, required: true, min: 1 },
    stok: { type: Number, required: true, min: 0 },
    berlakuSampai: Date,
    aktif: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.Voucher || mongoose.model('Voucher', voucherSchema);
