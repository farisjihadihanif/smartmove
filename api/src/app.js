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
import { createMidtrans } from './services/midtrans.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { homeRouter } from './routes/home.js';
import { placesRouter } from './routes/places.js';
import { routesRouter } from './routes/routes.js';
import { streetviewRouter } from './routes/streetview.js';
import { tripsRouter } from './routes/trips.js';
import { transitRouter } from './routes/transit.js';
import { trafficRouter } from './routes/traffic.js';
import { campaignRouter } from './routes/campaign.js';
import { adminRouter } from './routes/admin/index.js';
import { paymentsRouter } from './routes/payments.js';
import { rewardsRouter } from './routes/rewards.js';

export function createApp(opts = {}) {
  const cfg = { ...config, ...opts };
  const mailer = cfg.mailer || createMailer(cfg);
  const midtrans = cfg.midtransClient || createMidtrans(cfg);
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
  api.use('/trips', tripsRouter(cfg));
  api.use('/transit', transitRouter(cfg));
  api.use('/campaign', campaignRouter());
  api.use('/payments', paymentsRouter(cfg, { midtrans }));
  api.use('/rewards', rewardsRouter());
  api.use('/admin', adminRouter(cfg));
  // Satu kuota bersama untuk semua endpoint yang memanggil layanan peta.
  const mapLimit = rateLimit({
    windowMs: cfg.mapRateLimit.windowMs,
    limit: cfg.mapRateLimit.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Terlalu banyak permintaan, coba lagi nanti' },
  });
  api.use('/places', mapLimit, placesRouter(cfg));
  api.use('/routes', mapLimit, routesRouter(cfg));
  api.use('/streetview', mapLimit, streetviewRouter(cfg));
  api.use('/traffic', trafficRouter(cfg, { mapLimit }));

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
