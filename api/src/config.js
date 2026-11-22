import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const env = process.env;
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const config = {
  nodeEnv: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 4200,
  mongoUrl: env.MONGO_URL,
  jwtSecret: env.JWT_SECRET,
  jwtDays: Number(env.JWT_DAYS) || 7,
  clientOrigin: (env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Kota aktif (src/cities). Bawaan: medan.
  city: env.CITY || 'medan',
  // Jumlah proxy di depan API yang dipercaya untuk IP klien (Render: 1). Lihat DEPLOY.md.
  trustProxy: env.TRUST_PROXY === undefined || env.TRUST_PROXY === '' ? 1 : Number(env.TRUST_PROXY),
  // lax (bawaan) | none (web & API beda domain tanpa rewrite).
  cookieSameSite: (env.COOKIE_SAMESITE || 'lax').toLowerCase(),
  appUrl: env.APP_URL || 'http://localhost:4200',
  dnsServers: (env.DNS_SERVERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  admin: {
    email: env.ADMIN_EMAIL,
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    limit: Number(env.RATE_LIMIT) || 300,
  },
  // Batas lebih ketat untuk login/daftar/lupa/reset password (anti tebak password).
  authRateLimit: {
    windowMs: 15 * 60 * 1000,
    limit: Number(env.AUTH_RATE_LIMIT) || 20,
  },
  // Layanan peta (places, routes): 60 permintaan/menit/IP (ARCHITECTURE §8).
  mapRateLimit: {
    windowMs: 60 * 1000,
    limit: Number(env.MAP_RATE_LIMIT) || 60,
  },
  // OSRM per profil; kosong = server FOSSGIS (lihat services/osrm.js).
  osrmUrlCar: env.OSRM_URL_CAR,
  osrmUrlFoot: env.OSRM_URL_FOOT,
  nominatimUrl: env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  nominatimEmail: env.NOMINATIM_EMAIL,
  // Impor koridor & halte (npm run impor:osm). Kosong = overpass-api.de.
  overpassUrl: env.OVERPASS_URL,
  // Sumber info lalu lintas (services/trafficProvider.js). Bawaan: komunitas.
  trafficProvider: env.TRAFFIC_PROVIDER || 'komunitas',
  // Foto jalan (Street view). Token hanya di server.
  mapillaryToken: env.MAPILLARY_TOKEN,
  mapillaryUrl: env.MAPILLARY_URL,
  // Midtrans Core API — selalu sandbox (TASK Keputusan #7). Server key hanya di API.
  midtrans: {
    serverKey: env.MIDTRANS_SERVER_KEY,
    clientKey: env.MIDTRANS_CLIENT_KEY,
  },
  // Kebijakan OSM: User-Agent yang mengenali aplikasi + alamat kontak.
  mapUserAgent: `SmartMoveMedan/1.0 (+${env.APP_URL || 'http://localhost:4200'})`,
  // console | smtp (lihat services/mail.js). Diabaikan di produksi.
  mailMode: env.MAIL_MODE || 'console',
  // smtp (bawaan, dev lokal) | brevo | resend (API HTTP; Render free memblokir port SMTP).
  mailProvider: (env.MAIL_PROVIDER || 'smtp').toLowerCase(),
  mailFrom: env.MAIL_FROM || env.SMTP_FROM || env.SMTP_USER,
  brevoApiKey: env.BREVO_API_KEY,
  resendApiKey: env.RESEND_API_KEY,
  smtp: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM || env.SMTP_USER,
  },
  // Berkas lama sebelum GridFS (disk, /uploads). Unggahan baru disimpan di GridFS.
  uploadDir: env.UPLOAD_DIR || path.join(apiRoot, 'uploads'),
};

export function assertConfig(cfg = config) {
  const missing = [];
  if (!cfg.mongoUrl) missing.push('MONGO_URL');
  if (!cfg.jwtSecret) missing.push('JWT_SECRET');
  if (cfg.nodeEnv === 'production') {
    // Origin web wajib diisi di produksi (cookie + CORS); bawaan localhost tidak berguna.
    if (!env.CLIENT_ORIGIN) missing.push('CLIENT_ORIGIN');
    if (!env.APP_URL) missing.push('APP_URL');
  }
  if (missing.length) {
    throw new Error(`Variabel lingkungan wajib belum diisi: ${missing.join(', ')}`);
  }
}

export default config;
