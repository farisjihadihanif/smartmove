import express from 'express';
import { httpError } from '../lib/httpError.js';
import { str } from '../lib/validate.js';
import { parseLatLng, wajibDalamWilayah } from '../lib/wilayah.js';
import { denganCache } from '../services/cache.js';
import { createOsrm, keRute, PROFIL } from '../services/osrm.js';

// Titik dibulatkan 4 desimal (±11 m) untuk kunci cache dan permintaan OSRM.
const bulat = ({ lat, lng }) => ({ lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) });

export function routesRouter(cfg) {
  const r = express.Router();
  const osrm = cfg.osrm || createOsrm(cfg, { fetch: cfg.fetch });

  // GET /routes?from=lat,lng&to=lat,lng&mode=driving|motorcycle|walking
  r.get('/', async (req, res) => {
    const mode = str(req.query.mode) || 'driving';
    if (!PROFIL[mode]) throw httpError(400, 'Moda harus driving, motorcycle, atau walking');
    const from = bulat(wajibDalamWilayah(parseLatLng(req.query.from, 'Parameter from')));
    const to = bulat(wajibDalamWilayah(parseLatLng(req.query.to, 'Parameter to')));

    const kunci = `routes:${mode}:${from.lat},${from.lng};${to.lat},${to.lng}`;
    const rute = await denganCache(kunci, async () => {
      const hasil = keRute(await osrm.route(from, to, PROFIL[mode]), mode);
      if (!hasil) throw httpError(404, 'Rute tidak ditemukan', 'RUTE_TIDAK_ADA');
      return hasil;
    });
    res.json(rute);
  });

  return r;
}
