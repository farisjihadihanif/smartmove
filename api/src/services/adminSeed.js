import bcrypt from 'bcrypt';
import User from '../models/User.js';

// Membuat akun admin dari ADMIN_EMAIL/ADMIN_USERNAME/ADMIN_PASSWORD bila belum ada.
// Akun yang sudah ada tidak pernah diubah: password tidak ditimpa dan akun user
// biasa tidak pernah dinaikkan jadi admin. Bila email/username .env sudah dipakai
// user biasa, seed dibatalkan dan peringatan ditulis ke log.
export async function ensureAdmin({ email, username, password } = {}, { logger = console } = {}) {
  if (!email || !username || !password) return { status: 'dilewati' };

  const existing = await User.find({
    $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
  });

  const bentrok = existing.filter((u) => u.role !== 'admin');
  if (bentrok.length > 0) {
    const field = [
      bentrok.some((u) => u.email === email.toLowerCase()) && 'email',
      bentrok.some((u) => u.username === username.toLowerCase()) && 'username',
    ].filter(Boolean);
    logger.warn(
      `Peringatan: ${field.join(' dan ')} admin di .env sudah dipakai akun user biasa. ` +
        'Akun admin tidak dibuat dan tidak ada akun yang diubah. Ganti ADMIN_EMAIL/ADMIN_USERNAME.',
    );
    return { status: 'bentrok', field };
  }

  if (existing.length > 0) return { status: 'sudah_ada', id: existing[0].id };

  const user = await User.create({
    email,
    username,
    password: await bcrypt.hash(password, 12),
    role: 'admin',
  });
  return { status: 'dibuat', id: user.id };
}
