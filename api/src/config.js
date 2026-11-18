import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const env = process.env;

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
  admin: {
    email: env.ADMIN_EMAIL,
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    limit: Number(env.RATE_LIMIT) || 300,
  },
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
