import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { httpError } from '../lib/httpError.js';
import { str } from '../lib/validate.js';
import { dalamWilayah, jarakMeter, parseLatLng, wajibDalamWilayah } from '../lib/wilayah.js';
import { denganCache } from '../services/cache.js';
import { createNominatim, keTempat } from '../services/nominatim.js';

const MAKS_HASIL = 10;

export function placesRouter(cfg) {
  const r = express.Router();
  const nominatim = cfg.nominatim || createNominatim(cfg, { fetch: cfg.fetch });

  r.use(
    rateLimit({
      windowMs: cfg.mapRateLimit.windowMs,
      limit: cfg.mapRateLimit.limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Terlalu banyak permintaan, coba lagi nanti' },
    }),
  );

  // GET /places/search?q=&near=lat,lng → { items }
  // Hasil dibatasi Mebidang. `near` (opsional) hanya mengurutkan dari yang terdekat;
  // bila di luar wilayah diabaikan (pengguna boleh mencari tempat di Medan dari luar kota).
  r.get('/search', async (req, res) => {
    const q = str(req.query.q).replace(/\s+/g, ' ');
    if (q.length < 2) throw httpError(400, 'Kata kunci minimal 2 karakter');
    if (q.length > 100) throw httpError(400, 'Kata kunci maksimal 100 karakter');
    const near = req.query.near ? parseLatLng(req.query.near, 'Parameter near') : null;

    const mentah = await denganCache(`places:search:${q.toLowerCase()}`, () =>
      nominatim.search(q, { limit: MAKS_HASIL }),
    );
    let items = (Array.isArray(mentah) ? mentah : [])
      .map(keTempat)
      .filter((t) => Number.isFinite(t.lokasi.lat) && Number.isFinite(t.lokasi.lng) && dalamWilayah(t.lokasi));

    if (near && dalamWilayah(near)) {
      items = items
        .map((t) => ({ ...t, jarakM: Math.round(jarakMeter(near, t.lokasi)) }))
        .sort((a, b) => a.jarakM - b.jarakM);
    }
    res.json({ items: items.slice(0, MAKS_HASIL) });
  });

  // GET /places/reverse?at=lat,lng → { tempat }
  r.get('/reverse', async (req, res) => {
    const at = wajibDalamWilayah(parseLatLng(req.query.at, 'Parameter at'));
    const bulat = (n) => n.toFixed(4); // ±11 m
    const mentah = await denganCache(`places:reverse:${bulat(at.lat)},${bulat(at.lng)}`, () =>
      nominatim.reverse(at),
    );
    if (!mentah || mentah.error || mentah.lat === undefined) {
      throw httpError(404, 'Nama lokasi tidak ditemukan');
    }
    res.json({ tempat: keTempat(mentah) });
  });

  return r;
}
