import mongoose from 'mongoose';
import { lineStringSchema } from './geo.js';

const transitLineSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nama: { type: String, required: true, trim: true },
    jenis: { type: String, enum: ['bus', 'kereta', 'angkot'], required: true },
    operator: { type: String, trim: true },
    warna: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
    // null = belum diisi admin (data OSM jarang punya tarif).
    tarif: { type: Number, min: 0, default: null },
    kecepatanRataKmj: { type: Number, min: 1, default: 20 },
    jamOperasi: { type: String, trim: true }, // mis. "05.30–21.00"
    jalur: { type: lineStringSchema },
    // Asal data. `osmId` = "relation/<id>" untuk hasil `npm run impor:osm`.
    sumber: { type: String, enum: ['osm', 'admin'], default: 'admin' },
    osmId: { type: String, trim: true },
    // true setelah admin mengubah/menyembunyikan koridor: impor OSM tidak menyentuhnya lagi.
    dikoreksiAdmin: { type: Boolean, default: false },
    // false = disembunyikan admin (koridor OSM jangan dihapus, nanti terimpor ulang).
    aktif: { type: Boolean, default: true },
    diperbaruiPada: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

transitLineSchema.index({ osmId: 1 }, { unique: true, partialFilterExpression: { osmId: { $type: 'string' } } });

export default mongoose.models.TransitLine || mongoose.model('TransitLine', transitLineSchema);
