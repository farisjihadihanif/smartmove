import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import User from '../models/User.js';
import { httpError } from '../lib/httpError.js';
import { hashPassword, checkPassword as cocok } from '../lib/password.js';
import { str, checkUsername, checkPassword } from '../lib/validate.js';
import { requireAuth, publicUser, signToken, setAuthCookie } from '../middleware/auth.js';

export const FOTO_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_PREFIX = '/uploads/avatars/';

// Jenis gambar dicek dari isi file (magic bytes), bukan dari mimetype kiriman klien.
function jenisGambar(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'webp';
  return null;
}

const FIELD_TEKS = { namaLengkap: 100, telepon: 20, alamat: 200, bio: 300 };

export function usersRouter(cfg) {
  const r = express.Router();
  const avatarDir = path.join(cfg.uploadDir, 'avatars');

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: FOTO_MAX_BYTES, files: 1, fields: 20 },
  }).single('foto');

  function terimaFoto(req, res, next) {
    if (!req.is('multipart/form-data')) return next();
    upload(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(httpError(413, 'Ukuran foto maksimal 2 MB'));
        return next(httpError(400, 'Unggahan foto tidak valid'));
      }
      next(err);
    });
  }

  r.patch('/me', requireAuth, terimaFoto, async (req, res) => {
    const b = req.body || {};
    const user = req.user;

    if (b.username !== undefined) {
      const username = checkUsername(b.username);
      if (username !== user.username) {
        if (await User.exists({ username, _id: { $ne: user._id } })) {
          throw httpError(409, 'Username sudah dipakai');
        }
        user.username = username;
      }
    }
    for (const [field, max] of Object.entries(FIELD_TEKS)) {
      if (b[field] === undefined) continue;
      const v = str(b[field]);
      if (v.length > max) throw httpError(400, `${field} maksimal ${max} karakter`);
      user[field] = v || undefined;
    }

    let fotoLama;
    let fotoBaru;
    if (req.file) {
      const ext = jenisGambar(req.file.buffer);
      if (!ext) throw httpError(400, 'Foto harus berupa gambar JPG, PNG, atau WEBP');
      await fs.mkdir(avatarDir, { recursive: true });
      const nama = `${user.id}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
      fotoBaru = path.join(avatarDir, nama);
      await fs.writeFile(fotoBaru, req.file.buffer);
      fotoLama = user.foto;
      user.foto = AVATAR_PREFIX + nama;
    }

    try {
      await user.save();
    } catch (err) {
      if (fotoBaru) await fs.rm(fotoBaru, { force: true });
      throw err;
    }
    if (fotoLama?.startsWith(AVATAR_PREFIX)) {
      await fs.rm(path.join(avatarDir, path.basename(fotoLama)), { force: true });
    }
    res.json({ user: publicUser(user) });
  });

  // Ganti password: sesi lain dicabut (tokenVersion++), sesi ini diberi token baru.
  r.put('/me/password', requireAuth, async (req, res) => {
    const b = req.body || {};
    if (typeof b.passwordLama !== 'string' || !b.passwordLama) {
      throw httpError(400, 'Password lama wajib diisi');
    }
    const passwordBaru = checkPassword(b.passwordBaru, 'Password baru');
    const user = await User.findById(req.user._id).select('+password');
    if (!(await cocok(b.passwordLama, user.password))) throw httpError(400, 'Password lama salah');

    user.password = await hashPassword(passwordBaru);
    user.tokenVersion += 1;
    await user.save();

    const token = signToken(user, cfg);
    setAuthCookie(res, token, cfg);
    res.json({ user: publicUser(user), token });
  });

  return r;
}
