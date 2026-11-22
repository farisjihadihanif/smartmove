import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import mongoose from 'mongoose';

// Penyimpanan gambar unggahan (foto profil, poster kampanye) di MongoDB GridFS.
// Hosting gratis (Render) punya disk sementara yang hilang tiap deploy/restart, jadi
// berkas tidak lagi disimpan di disk. Disajikan lewat GET /api/files/:id.<ext>.

export const BERKAS_PREFIX = '/api/files/';
const BUCKET = 'berkas';
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
// Berkas lama sebelum GridFS (disimpan di disk, disajikan di /uploads).
const LAMA_PREFIX = '/uploads/';

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });

function idDari(url) {
  if (typeof url !== 'string' || !url.startsWith(BERKAS_PREFIX)) return null;
  const hex = url.slice(BERKAS_PREFIX.length).split('.')[0];
  return mongoose.isObjectIdOrHexString(hex) && /^[a-f0-9]{24}$/i.test(hex) ? new mongoose.Types.ObjectId(hex) : null;
}

/** Simpan buffer gambar (`ext` = jpg|png|webp) → URL publik `/api/files/<id>.<ext>`. */
export async function simpanBerkas(buffer, { ext, folder, pemilik } = {}) {
  const contentType = MIME[ext];
  if (!contentType) throw new Error(`Jenis berkas tidak didukung: ${ext}`);
  const up = bucket().openUploadStream(`${folder || 'lain'}.${ext}`, {
    metadata: { contentType, folder, pemilik: pemilik ? String(pemilik) : undefined },
  });
  await new Promise((resolve, reject) => {
    up.once('finish', resolve);
    up.once('error', reject);
    up.end(buffer);
  });
  return `${BERKAS_PREFIX}${up.id.toHexString()}.${ext}`;
}

/** Hapus berkas dari URL-nya. URL lain diabaikan; berkas lama di disk ikut dihapus bila ada. */
export async function hapusBerkas(url, { uploadDir } = {}) {
  const id = idDari(url);
  if (id) {
    await bucket()
      .delete(id)
      .catch((err) => {
        if (!/FileNotFound|not found/i.test(err?.message || '')) throw err;
      });
    return;
  }
  if (uploadDir && typeof url === 'string' && url.startsWith(LAMA_PREFIX)) {
    const rel = path.normalize(url.slice(LAMA_PREFIX.length));
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) await fs.rm(path.join(uploadDir, rel), { force: true });
  }
}

/** GET /api/files/:nama — isi tidak pernah berubah (id baru tiap unggah), jadi boleh di-cache lama. */
export function berkasRouter() {
  const r = express.Router();
  r.get('/:nama', async (req, res, next) => {
    const id = idDari(BERKAS_PREFIX + req.params.nama);
    if (!id) return next();
    const [file] = await bucket().find({ _id: id }).limit(1).toArray();
    if (!file) return next();
    res.set({
      'Content-Type': file.metadata?.contentType || 'application/octet-stream',
      'Content-Length': String(file.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Boleh dimuat dari origin lain (web dev, aplikasi mobile).
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    bucket()
      .openDownloadStream(id)
      .on('error', next)
      .pipe(res);
  });
  return r;
}
