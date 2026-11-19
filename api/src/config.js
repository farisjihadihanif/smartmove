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
  // Kebijakan OSM: User-Agent yang mengenali aplikasi + alamat kontak.
  mapUserAgent: `SmartMoveMedan/1.0 (+${env.APP_URL || 'http://localhost:4200'})`,
  // console | smtp (lihat services/mail.js). Diabaikan di produksi.
  mailMode: env.MAIL_MODE || 'console',
  smtp: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM || env.SMTP_USER,
  },
  // Foto profil disimpan di disk dan disajikan di /uploads.
  uploadDir: env.UPLOAD_DIR || path.join(apiRoot, 'uploads'),
};

export function assertConfig(cfg = config) {
  const missing = [];
  if (!cfg.mongoUrl) missing.push('MONGO_URL');
  if (!cfg.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(`Variabel lingkungan wajib belum diisi: ${missing.join(', ')}`);
  }
}

export default config;
