import mongoose from 'mongoose';

export const GEOCACHE_TTL_S = 15 * 60;

const geoCacheSchema = new mongoose.Schema({
  kunci: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: GEOCACHE_TTL_S },
});

export default mongoose.models.GeoCache || mongoose.model('GeoCache', geoCacheSchema);
