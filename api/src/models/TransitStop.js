import mongoose from 'mongoose';
import { pointSchema, ref } from './geo.js';

const stopLineSchema = new mongoose.Schema(
  { line: ref('TransitLine'), urutan: { type: Number, required: true, min: 0 } },
  { _id: false },
);

const transitStopSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, trim: true },
    lokasi: { type: pointSchema, required: true },
    lines: [stopLineSchema],
    // Asal data. `osmId` = "node/<id>" untuk hasil `npm run impor:osm`.
    sumber: { type: String, enum: ['osm', 'admin'], default: 'admin' },
    osmId: { type: String, trim: true },
    // true setelah admin mengubah halte: impor OSM tidak menyentuhnya lagi.
    dikoreksiAdmin: { type: Boolean, default: false },
  },
  { timestamps: true },
);

transitStopSchema.index({ lokasi: '2dsphere' });
transitStopSchema.index({ 'lines.line': 1, 'lines.urutan': 1 });
transitStopSchema.index({ osmId: 1 }, { unique: true, partialFilterExpression: { osmId: { $type: 'string' } } });

export default mongoose.models.TransitStop || mongoose.model('TransitStop', transitStopSchema);
