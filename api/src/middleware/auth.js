import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { httpError } from '../lib/httpError.js';

export const COOKIE_NAME = 'token';

// JWT berisi `sub` (id pengguna) + `v` (tokenVersion) — API_SPECS §4.
export function signToken(user, cfg) {
  return jwt.sign({ sub: user.id, v: user.tokenVersion }, cfg.jwtSecret, {
    expiresIn: `${cfg.jwtDays}d`,
    algorithm: 'HS256',
  });
}

export function cookieOptions(cfg) {
  return {
    httpOnly: true,
    // lax: web memanggil API lewat rewrite Vercel (satu domain). `none` hanya bila web
    // memanggil API lintas domain langsung (VITE_API_URL); `none` selalu butuh Secure.
    sameSite: cfg.cookieSameSite === 'none' ? 'none' : 'lax',
    secure: cfg.nodeEnv === 'production' || cfg.cookieSameSite === 'none',
    path: '/',
  };
}

// Web: cookie httpOnly. "Ingat saya" = cookie bertahan jwtDays; selain itu cookie sesi.
export function setAuthCookie(res, token, cfg, ingat = true) {
  const opts = cookieOptions(cfg);
  if (ingat) opts.maxAge = cfg.jwtDays * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE_NAME, token, opts);
}

export function clearAuthCookie(res, cfg) {
  res.clearCookie(COOKIE_NAME, cookieOptions(cfg));
}

function readToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[COOKIE_NAME];
}

// Mengisi req.user bila token sah; tidak pernah menolak permintaan.
export function loadUser(cfg) {
  return async (req, res, next) => {
    req.user = null;
    const token = readToken(req);
    if (!token) return next();
    let payload;
    try {
      payload = jwt.verify(token, cfg.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return next();
    }
    const user = await User.findById(payload.sub).catch(() => null);
    if (user && user.tokenVersion === payload.v) req.user = user;
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(httpError(401, 'Silakan masuk terlebih dahulu'));
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return next(httpError(401, 'Silakan masuk terlebih dahulu'));
  if (req.user.role !== 'admin') return next(httpError(403, 'Kamu tidak punya akses ke fitur ini'));
  next();
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    namaLengkap: u.namaLengkap ?? null,
    telepon: u.telepon ?? null,
    alamat: u.alamat ?? null,
    bio: u.bio ?? null,
    foto: u.foto ?? null,
    poin: u.poin,
    createdAt: u.createdAt,
  };
}
