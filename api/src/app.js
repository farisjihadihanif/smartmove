import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import config from './config.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp(opts = {}) {
  const cfg = { ...config, ...opts };
  const app = express();

  app.set('trust proxy', 1); // di belakang Nginx
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: cfg.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

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

  // Router fitur (auth, users, places, ...) dipasang di tugas berikutnya.

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
