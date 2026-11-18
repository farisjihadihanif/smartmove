import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema(
  {
    jenis: { type: String, enum: ['tips', 'poster'], required: true },
    judul: { type: String, required: true, trim: true },
    isi: String,
    gambar: String,
    urutan: { type: Number, default: 0 },
    aktif: { type: Boolean, default: true },
  },
  { timestamps: true },
);

contentSchema.index({ jenis: 1, aktif: 1, urutan: 1 });

export default mongoose.models.Content || mongoose.model('Content', contentSchema);
