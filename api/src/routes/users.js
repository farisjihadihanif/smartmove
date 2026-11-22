import express from 'express';
import User from '../models/User.js';
import { jenisGambar, terimaGambar } from '../lib/gambar.js';
import { httpError } from '../lib/httpError.js';
import { hashPassword, checkPassword as cocok } from '../lib/password.js';
import { str, checkUsername, checkPassword } from '../lib/validate.js';
import { BERKAS_PREFIX, hapusBerkas, simpanBerkas } from '../services/berkas.js';
import { requireAuth, publicUser, signToken, setAuthCookie } from '../middleware/auth.js';

export const FOTO_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_PREFIX = BERKAS_PREFIX; // GridFS (services/berkas.js)

const FIELD_TEKS = { namaLengkap: 100, telepon: 20, alamat: 200, bio: 300 };

export function usersRouter(cfg) {
  const r = express.Router();

  const terimaFoto = terimaGambar('foto', { maxBytes: FOTO_MAX_BYTES, label: 'foto' });

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
      fotoBaru = await simpanBerkas(req.file.buffer, { ext, folder: 'avatars', pemilik: user._id });
      fotoLama = user.foto;
      user.foto = fotoBaru;
    }

    try {
      await user.save();
    } catch (err) {
      if (fotoBaru) await hapusBerkas(fotoBaru);
      throw err;
    }
    if (fotoLama) await hapusBerkas(fotoLama, { uploadDir: cfg.uploadDir });
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
