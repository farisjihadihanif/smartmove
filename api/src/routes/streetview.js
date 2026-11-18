import express from 'express';
import { httpError } from '../lib/httpError.js';
import { parseLatLng, wajibDalamWilayah } from '../lib/wilayah.js';
import { denganCache } from '../services/cache.js';
import { createMapillary, fotoTerdekat } from '../services/mapillary.js';

export function streetviewRouter(cfg) {
  const r = express.Router();
  const mapillary = cfg.mapillary || createMapillary(cfg, { fetch: cfg.fetch });

  // GET /streetview?at=lat,lng → { foto } (null = belum ada foto jalan di sekitar titik)
  r.get('/', async (req, res) => {
    const at = wajibDalamWilayah(parseLatLng(req.query.at, 'Parameter at'));
    if (!mapillary.aktif) throw httpError(503, 'Foto jalan belum tersedia', 'FOTO_JALAN_NONAKTIF');
    const titik = { lat: Number(at.lat.toFixed(4)), lng: Number(at.lng.toFixed(4)) }; // ±11 m
    const hasil = await denganCache(`streetview:${titik.lat},${titik.lng}`, async () => ({
      foto: fotoTerdekat(await mapillary.sekitar(titik), titik),
    }));
    res.json(hasil);
  });

  return r;
}
