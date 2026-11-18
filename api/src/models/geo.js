import mongoose from 'mongoose';

const lngLat = (c) =>
  Array.isArray(c) &&
  c.length === 2 &&
  c[0] >= -180 &&
  c[0] <= 180 &&
  c[1] >= -90 &&
  c[1] <= 90;

// GeoJSON Point, koordinat [lng, lat]. Dipakai sebagai subdokumen
// (`{ type: pointSchema }`) supaya field opsional tetap kosong (aman untuk 2dsphere).
export const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: { validator: lngLat, message: 'Koordinat harus [lng, lat] yang valid' },
    },
  },
  { _id: false },
);

export const lineStringSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['LineString'], default: 'LineString', required: true },
    coordinates: {
      type: [[Number]],
      required: true,
      validate: {
        validator: (cs) => Array.isArray(cs) && cs.length >= 2 && cs.every(lngLat),
        message: 'LineString minimal 2 titik [lng, lat] yang valid',
      },
    },
  },
  { _id: false },
);

export const ref = (model, required = true) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required,
});
