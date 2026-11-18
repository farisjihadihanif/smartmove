import mongoose from 'mongoose';
import { pointSchema } from './geo.js';

const eventSchema = new mongoose.Schema(
  {
    judul: { type: String, required: true, trim: true },
    isi: { type: String, required: true },
    lokasi: { type: pointSchema }, // opsional
    mulai: { type: Date, required: true },
    selesai: {
      type: Date,
      required: true,
      validate: {
        validator(v) {
          return !this.mulai || v >= this.mulai;
        },
        message: 'Waktu selesai harus setelah waktu mulai',
      },
    },
    jenis: { type: String, enum: ['cfd', 'rekayasa_arus', 'acara', 'lainnya'], default: 'lainnya' },
  },
  { timestamps: true },
);

eventSchema.index({ lokasi: '2dsphere' });
eventSchema.index({ selesai: 1, mulai: 1 });

export default mongoose.models.Event || mongoose.model('Event', eventSchema);
