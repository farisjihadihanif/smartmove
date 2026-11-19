import mongoose from 'mongoose';
import { lineStringSchema } from './geo.js';

// Koridor jalan utama untuk tab "Estimasi Waktu" Live Traffic. Geometri diambil dari
// OSM (`npm run impor:jalan`); admin hanya mengoreksi bila salah (T-208).
const roadCorridorSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nama: { type: String, required: true, trim: true },
    urutan: { type: Number, default: 0 },
    jalur: { type: lineStringSchema, required: true },
    panjangM: { type: Number, min: 0, required: true },
    // Nama ruas OSM yang ikut digabung + jumlah way, untuk ditelusuri admin.
    namaOsm: { type: [String], default: [] },
    jumlahWay: { type: Number, default: 0 },
    sumber: { type: String, enum: ['osm', 'admin'], default: 'osm' },
    // true setelah admin mengubah geometri: impor ulang tidak menimpanya.
    dikoreksiAdmin: { type: Boolean, default: false },
    aktif: { type: Boolean, default: true },
    diperbaruiPada: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.RoadCorridor || mongoose.model('RoadCorridor', roadCorridorSchema);
