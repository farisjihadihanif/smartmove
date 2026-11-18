import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import User from '../models/User.js';
import { httpError } from '../lib/httpError.js';
import { hashPassword, checkPassword as cocok, checkDummy } from '../lib/password.js';
import { str, checkUsername, checkEmail, checkPassword } from '../lib/validate.js';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth, publicUser } from '../middleware/auth.js';

export const RESET_TTL_MS = 30 * 60 * 1000; // ARCHITECTURE §5.5
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const PESAN_LUPA = 'Jika email terdaftar, tautan reset password sudah dikirim. Cek kotak masuk atau folder spam.';

export function authRouter(cfg, { mailer }) {
  const r = express.Router();

  const ketat = rateLimit({
    windowMs: cfg.authRateLimit.windowMs,
    limit: cfg.authRateLimit.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Terlalu banyak percobaan, coba lagi dalam beberapa menit' },
  });

  function kirimSesi(res, user, status = 200, ingat = true) {
    const token = signToken(user, cfg);
    setAuthCookie(res, token, cfg, ingat);
    res.status(status).json({ user: publicUser(user), token });
  }

  // Registrasi publik selalu role "user"; field role diabaikan (AGENTS aturan 6).
  r.post('/register', ketat, async (req, res) => {
    const b = req.body || {};
    const username = checkUsername(b.username);
    const email = checkEmail(b.email);
    const password = checkPassword(b.password);
    const namaLengkap = str(b.namaLengkap).slice(0, 100) || undefined;

    const ada = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (ada) {
      throw httpError(409, ada.email === email ? 'Email sudah terdaftar' : 'Username sudah dipakai');
    }
    const user = await User.create({
      username,
      email,
      namaLengkap,
      password: await hashPassword(password),
      role: 'user',
    });
    kirimSesi(res, user, 201, b.ingat !== false);
  });

  // `username` boleh berisi username atau email.
  r.post('/login', ketat, async (req, res) => {
    const b = req.body || {};
    const id = str(b.username || b.email).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    if (!id || !password) throw httpError(400, 'Username/email dan password wajib diisi');

    const user = await User.findOne(id.includes('@') ? { email: id } : { username: id }).select('+password');
    const sah = user ? await cocok(password, user.password) : await checkDummy(password);
    if (!sah) throw httpError(401, 'Username/email atau password salah');
    kirimSesi(res, user, 200, b.ingat !== false);
  });

  // Keluar dari perangkat ini: hapus cookie (mobile menghapus token di secure storage).
  r.post('/logout', requireAuth, (req, res) => {
    clearAuthCookie(res, cfg);
    res.json({ message: 'Berhasil keluar' });
  });

  r.get('/me', (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  // Respons selalu sama agar tidak membocorkan email mana yang terdaftar.
  r.post('/forgot', ketat, async (req, res) => {
    const email = checkEmail(req.body?.email);
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetTokenHash = sha256(token);
      user.resetTokenExpires = new Date(Date.now() + RESET_TTL_MS);
      await user.save();
      const link = `${cfg.appUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
      try {
        await mailer.send({
          to: user.email,
          subject: 'Reset password SmartMove Medan',
          text:
            `Halo ${user.namaLengkap || user.username},\n\n` +
            `Buka tautan berikut untuk membuat password baru (berlaku 30 menit):\n${link}\n\n` +
            'Abaikan email ini bila kamu tidak meminta reset password.',
          html:
            `<p>Halo ${escapeHtml(user.namaLengkap || user.username)},</p>` +
            `<p>Klik tautan berikut untuk membuat password baru (berlaku 30 menit):</p>` +
            `<p><a href="${link}">Reset password</a></p>` +
            '<p>Abaikan email ini bila kamu tidak meminta reset password.</p>',
        });
      } catch (err) {
        if (cfg.nodeEnv !== 'test') console.error('Gagal mengirim email reset:', err.message);
      }
    }
    res.json({ message: PESAN_LUPA });
  });

  r.post('/reset', ketat, async (req, res) => {
    const token = str(req.body?.token);
    const password = checkPassword(req.body?.password, 'Password baru');
    if (!/^[a-f0-9]{64}$/.test(token)) throw httpError(400, 'Tautan reset tidak valid atau sudah kedaluwarsa');

    const user = await User.findOneAndUpdate(
      { resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() } },
      {
        $set: { password: await hashPassword(password) },
        $unset: { resetTokenHash: 1, resetTokenExpires: 1 },
        $inc: { tokenVersion: 1 }, // semua sesi lama tidak berlaku lagi
      },
      { returnDocument: 'after' },
    );
    if (!user) throw httpError(400, 'Tautan reset tidak valid atau sudah kedaluwarsa');
    res.json({ message: 'Password berhasil diganti. Silakan masuk dengan password baru.' });
  });

  return r;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
