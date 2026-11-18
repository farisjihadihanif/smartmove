import mongoose from 'mongoose';
import { HttpError } from '../lib/httpError.js';

export function notFound(req, res) {
  res.status(404).json({ message: 'Alamat tidak ditemukan' });
}

// Semua galat dikirim sebagai { message, code? } (API_SPECS §1, §3).
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    const body = { message: err.message };
    if (err.code) body.code = err.code;
    return res.status(err.status).json(body);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first?.message || 'Data tidak valid' });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: 'ID atau nilai tidak valid' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: 'Data sudah terdaftar' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format JSON tidak valid' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Ukuran data terlalu besar' });
  }

  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
}
