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
  },
  { timestamps: true },
);

transitStopSchema.index({ lokasi: '2dsphere' });
transitStopSchema.index({ 'lines.line': 1, 'lines.urutan': 1 });

export default mongoose.models.TransitStop || mongoose.model('TransitStop', transitStopSchema);
