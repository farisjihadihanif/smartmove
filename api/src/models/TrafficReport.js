import mongoose from 'mongoose';
import { pointSchema, ref } from './geo.js';

export const TRAFFIC_TTL_MS = 2 * 60 * 60 * 1000; // 2 jam (Aturan Bisnis #4)

const trafficReportSchema = new mongoose.Schema(
  {
    user: ref('User'),
    lokasi: { type: pointSchema, required: true },
    tingkat: { type: String, enum: ['lancar', 'padat', 'macet'], required: true },
    kejadian: {
      type: String,
      enum: ['none', 'kecelakaan', 'banjir', 'penutupan', 'perbaikan_jalan'],
      default: 'none',
    },
    catatan: { type: String, trim: true, maxlength: 200 },
    konfirmasi: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: () => new Date(Date.now() + TRAFFIC_TTL_MS) },
  },
  { timestamps: true },
);

trafficReportSchema.index({ lokasi: '2dsphere' });
trafficReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
trafficReportSchema.index({ user: 1, createdAt: -1 }); // batas laporan per user

export default mongoose.models.TrafficReport ||
  mongoose.model('TrafficReport', trafficReportSchema);
