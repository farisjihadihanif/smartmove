import mongoose from 'mongoose';
import { lineStringSchema } from './geo.js';

const transitLineSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nama: { type: String, required: true, trim: true },
    jenis: { type: String, enum: ['bus', 'kereta', 'angkot'], required: true },
    operator: { type: String, trim: true },
    warna: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
    tarif: { type: Number, required: true, min: 0 },
    kecepatanRataKmj: { type: Number, min: 1, default: 20 },
    jamOperasi: { type: String, trim: true }, // mis. "05.30–21.00"
    jalur: { type: lineStringSchema },
    diperbaruiPada: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.TransitLine || mongoose.model('TransitLine', transitLineSchema);
