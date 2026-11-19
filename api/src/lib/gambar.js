import multer from 'multer';
import { httpError } from './httpError.js';

// Jenis gambar dicek dari isi file (magic bytes), bukan dari mimetype kiriman klien.
export function jenisGambar(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'webp';
  return null;
}

/**
 * Middleware unggahan satu gambar (multipart, disimpan di memori) pada `field`.
 * Permintaan JSON biasa dilewatkan. `label` dipakai di pesan galat ("Ukuran foto maksimal 2 MB").
 */
export function terimaGambar(field, { maxBytes, label = 'gambar' }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 20 },
  }).single(field);
  const mb = Math.round(maxBytes / (1024 * 1024));
  return function (req, res, next) {
    if (!req.is('multipart/form-data')) return next();
    upload(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(httpError(413, `Ukuran ${label} maksimal ${mb} MB`));
        return next(httpError(400, `Unggahan ${label} tidak valid`));
      }
      next(err);
    });
  };
}
