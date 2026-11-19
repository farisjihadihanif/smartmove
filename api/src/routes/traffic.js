import express from 'express';
import { httpError } from '../lib/httpError.js';
import { str } from '../lib/validate.js';
import { wajibDalamWilayah } from '../lib/wilayah.js';
import { requireAuth } from '../middleware/auth.js';
import { createOsrm } from '../services/osrm.js';
import RoadCorridor from '../models/RoadCorridor.js';
import { createTrafficProvider } from '../services/trafficProvider.js';
import { KEJADIAN, TINGKAT, kirimLaporan, publicLaporan } from '../services/trafficReports.js';

const BBOX_MAKS_DERAJAT = 1; // ±110 km, cukup untuk seluruh Mebidang

// "minLng,minLat,maxLng,maxLat" → objek bbox. 400 bila salah / terlalu luas.
export function parseBbox(v) {
  const n = typeof v === 'string' ? v.split(',').map((s) => Number(s.trim())) : [];
  const [minLng, minLat, maxLng, maxLat] = n;
  const sah =
    n.length === 4 &&
    n.every(Number.isFinite) &&
    minLng >= -180 && maxLng <= 180 && minLat >= -90 && maxLat <= 90 &&
    minLng < maxLng && minLat < maxLat;
  if (!sah) throw httpError(400, 'Parameter bbox harus berformat minLng,minLat,maxLng,maxLat');
  if (maxLng - minLng > BBOX_MAKS_DERAJAT || maxLat - minLat > BBOX_MAKS_DERAJAT) {
    throw httpError(400, 'Area peta terlalu luas, perbesar peta dulu');
  }
  return { minLng, minLat, maxLng, maxLat };
}

function bacaLaporan(b) {
  const { lat, lng } = b?.lokasi || {};
  const angka = (x) => typeof x === 'number' && Number.isFinite(x);
  if (!angka(lat) || !angka(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw httpError(400, 'Lokasi laporan harus berupa {lat, lng}');
  }
  wajibDalamWilayah({ lat, lng });
  if (!TINGKAT.includes(b.tingkat)) throw httpError(400, `Tingkat harus salah satu dari: ${TINGKAT.join(', ')}`);
  const kejadian = b.kejadian ?? 'none';
  if (!KEJADIAN.includes(kejadian)) throw httpError(400, `Kejadian harus salah satu dari: ${KEJADIAN.join(', ')}`);
  if (b.catatan !== undefined && b.catatan !== null && typeof b.catatan !== 'string') {
    throw httpError(400, 'Catatan harus berupa teks');
  }
  const catatan = str(b.catatan);
  if (catatan.length > 200) throw httpError(400, 'Catatan maksimal 200 karakter');
  return { lat, lng, tingkat: b.tingkat, kejadian, catatan };
}

export function trafficRouter(cfg, { mapLimit } = {}) {
  const r = express.Router();
  const osrm = cfg.osrm || createOsrm(cfg, { fetch: cfg.fetch });
  const penyedia = cfg.traffic || createTrafficProvider(cfg, { osrm });
  const lewat = mapLimit || ((req, res, next) => next());

  // GET /traffic?bbox=minLng,minLat,maxLng,maxLat → laporan aktif di area peta.
  r.get('/', async (req, res) => {
    const bbox = parseBbox(req.query.bbox);
    res.json({ items: await penyedia.kejadianDiArea(bbox), sumber: penyedia.nama });
  });

  // GET /traffic/corridors → estimasi waktu koridor jalan utama (OSRM dicache).
  // Geometri koridor dari OSM (`npm run impor:jalan`); kosong bila belum diimpor.
  r.get('/corridors', lewat, async (req, res) => {
    const koridor = await RoadCorridor.find({ aktif: { $ne: false } })
      .sort({ urutan: 1, kode: 1 })
      .lean();
    const items = [];
    let gagal = 0;
    // Berurutan supaya cache kosong tidak membanjiri server OSRM publik.
    for (const k of koridor) {
      let est = null;
      try {
        est = await penyedia.estimasiKoridor(k);
      } catch (err) {
        if (err?.code !== 'LAYANAN_PETA_GAGAL') throw err;
        gagal++;
      }
      items.push({
        kode: k.kode,
        nama: k.nama,
        tersedia: Boolean(est),
        jarakM: k.panjangM,
        durasiNormalS: est?.durasiNormalS ?? null,
        durasiS: est?.durasiS ?? null,
        tingkat: est?.tingkat ?? null,
        laporan: est?.laporan ?? 0,
        kejadian: est?.kejadian ?? [],
        ditutup: est?.ditutup ?? false,
        garis: k.jalur.coordinates,
        segmen: est?.segmen ?? [],
        sumberGaris: k.sumber, // osm | admin
        garisDiperbaruiPada: k.diperbaruiPada,
      });
    }
    if (koridor.length && gagal === koridor.length) {
      throw httpError(502, 'Layanan peta sedang bermasalah, coba lagi nanti', 'LAYANAN_PETA_GAGAL');
    }
    res.json({ items, sumber: penyedia.nama, diperbaruiPada: new Date() });
  });

  // POST /traffic/reports — wajib login; dibatasi & digabung (services/trafficReports.js).
  r.post('/reports', requireAuth, async (req, res) => {
    const input = bacaLaporan(req.body || {});
    const { laporan, digabung } = await kirimLaporan(req.user, input);
    res.status(digabung ? 200 : 201).json({ laporan: publicLaporan(laporan), digabung });
  });

  return r;
}
