import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import config from './config.js';
import { errorHandler, notFound } from './middleware/error.js';
import { loadUser } from './middleware/auth.js';
import { createMailer } from './services/mail.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { homeRouter } from './routes/home.js';

export function createApp(opts = {}) {
  const cfg = { ...config, ...opts };
  const mailer = cfg.mailer || createMailer(cfg);
  const app = express();

  app.set('trust proxy', 1); // di belakang Nginx
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: cfg.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Foto profil. Boleh dimuat dari origin lain (web dev di port 5173, aplikasi mobile).
  app.use(
    '/uploads',
    (req, res, next) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(cfg.uploadDir, { index: false, dotfiles: 'deny', fallthrough: true }),
  );

  const api = express.Router();
  api.use(
    rateLimit({
      windowMs: cfg.rateLimit.windowMs,
      limit: cfg.rateLimit.limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Terlalu banyak permintaan, coba lagi nanti' },
    }),
  );

  api.get('/health', (req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 });
  });

  api.use(loadUser(cfg));
  api.use('/auth', authRouter(cfg, { mailer }));
  api.use('/users', usersRouter(cfg));
  api.use('/home', homeRouter(cfg));
  // Router fitur lain (places, routes, ...) dipasang di tugas berikutnya.

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
