import mongoose from 'mongoose';
import { pointSchema, ref } from './geo.js';

const tempatSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, trim: true },
    lokasi: { type: pointSchema, required: true },
  },
  { _id: false },
);

const tripSchema = new mongoose.Schema(
  {
    user: ref('User'),
    judul: { type: String, trim: true, maxlength: 100 },
    asal: { type: tempatSchema, required: true },
    tujuan: { type: tempatSchema, required: true },
    moda: { type: String, enum: ['driving', 'motorcycle', 'walking', 'transit'], required: true },
    berangkatPada: Date,
    ringkasan: {
      jarakM: { type: Number, min: 0 },
      durasiS: { type: Number, min: 0 },
      tarif: { type: Number, min: 0 },
      tarifPerkiraan: { type: Boolean }, // true = tarif bukan dari admin (bawaan/OSM)
    },
  },
  { timestamps: true },
);

tripSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Trip || mongoose.model('Trip', tripSchema);
