import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    namaLengkap: { type: String, trim: true },
    telepon: { type: String, trim: true },
    alamat: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 300 },
    foto: String,
    // Cache saldo; sumber kebenaran PointLedger (DATABASE §4.1).
    poin: { type: Number, default: 0, min: 0 },
    tokenVersion: { type: Number, default: 0 },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
