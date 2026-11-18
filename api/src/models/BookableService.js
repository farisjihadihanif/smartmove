import mongoose from 'mongoose';

const bookableServiceSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    jenis: {
      type: String,
      enum: ['bus', 'bus_antarkota', 'kereta', 'travel', 'parkir'],
      required: true,
    },
    operator: { type: String, trim: true },
    nama: { type: String, required: true, trim: true },
    asal: { type: String, trim: true },
    tujuan: { type: String, trim: true },
    jadwal: [{ type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }], // "HH:mm"
    harga: { type: Number, required: true, min: 0 }, // Rp/orang, atau Rp/jam untuk parkir
    aktif: { type: Boolean, default: true },
  },
  { timestamps: true },
);

bookableServiceSchema.index({ jenis: 1, aktif: 1 });

export default mongoose.models.BookableService ||
  mongoose.model('BookableService', bookableServiceSchema);
