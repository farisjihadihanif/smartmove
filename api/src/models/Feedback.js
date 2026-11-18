import mongoose from 'mongoose';
import { ref } from './geo.js';

const feedbackSchema = new mongoose.Schema(
  {
    user: ref('User'),
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: 'Rating harus bilangan bulat 1–5' },
    },
    komentar: { type: String, trim: true, maxlength: 1000 },
    fitur: { type: String, trim: true },
  },
  { timestamps: true },
);

export default mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
