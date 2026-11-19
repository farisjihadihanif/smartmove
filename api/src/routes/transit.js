import express from 'express';
import TransitLine from '../models/TransitLine.js';
import TransitStop from '../models/TransitStop.js';
import { httpError } from '../lib/httpError.js';
import { parseLatLng, wajibDalamWilayah } from '../lib/wilayah.js';
import { tarifKoridor } from '../services/tarif.js';

const RADIUS_BAWAAN = 800; // jarak jalan kaki ke halte (ARCHITECTURE §5.2)
const RADIUS_MAKS = 3000;
const HALTE_MAKS = 50;

const keLatLng = (p) => (p?.coordinates ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null);

const ringkasKoridor = (l) => ({
  kode: l.kode,
  nama: l.nama,
  jenis: l.jenis,
  operator: l.operator ?? null,
  warna: l.warna ?? null,
  ...tarifKoridor(l), // tarif null = belum ada; tarifPerkiraan = bukan dari admin
  jamOperasi: l.jamOperasi ?? null,
  kecepatanRataKmj: l.kecepatanRataKmj,
  diperbaruiPada: l.diperbaruiPada,
});

const PILIH_KORIDOR = 'kode nama jenis operator warna tarif tarifSumber jamOperasi kecepatanRataKmj diperbaruiPada';

function bacaRadius(v) {
  if (v === undefined || v === '') return RADIUS_BAWAAN;
  const r = Number(v);
  if (!Number.isFinite(r) || r < 50 || r > RADIUS_MAKS) {
    throw httpError(400, `Radius harus angka 50–${RADIUS_MAKS} meter`);
  }
  return r;
}

export function transitRouter() {
  const r = express.Router();

  // Daftar koridor aktif + jumlah halte.
  r.get('/lines', async (req, res) => {
    const filter = { aktif: { $ne: false } };
    if (req.query.jenis !== undefined) {
      if (!['bus', 'kereta', 'angkot'].includes(req.query.jenis)) {
        throw httpError(400, 'Jenis harus bus, kereta, atau angkot');
      }
      filter.jenis = req.query.jenis;
    }
    const lines = await TransitLine.find(filter, PILIH_KORIDOR).sort({ jenis: 1, kode: 1 }).lean();
    const jumlah = await TransitStop.aggregate([
      { $match: { 'lines.line': { $in: lines.map((l) => l._id) } } },
      { $unwind: '$lines' },
      { $group: { _id: '$lines.line', n: { $sum: 1 } } },
    ]);
    const per = new Map(jumlah.map((j) => [String(j._id), j.n]));
    res.json({ items: lines.map((l) => ({ ...ringkasKoridor(l), jumlahHalte: per.get(String(l._id)) || 0 })) });
  });

  // Satu koridor: garis jalur + halte berurutan.
  r.get('/lines/:kode', async (req, res) => {
    const kode = String(req.params.kode).trim().toUpperCase();
    const line = await TransitLine.findOne({ kode, aktif: { $ne: false } }, `${PILIH_KORIDOR} jalur`).lean();
    if (!line) throw httpError(404, 'Koridor tidak ditemukan');
    const stops = await TransitStop.find({ 'lines.line': line._id }, 'nama lokasi lines').lean();
    const halte = stops
      .flatMap((s) =>
        s.lines
          .filter((l) => String(l.line) === String(line._id))
          .map((l) => ({ id: String(s._id), nama: s.nama, lokasi: keLatLng(s.lokasi), urutan: l.urutan })),
      )
      .sort((a, b) => a.urutan - b.urutan);
    res.json({ line: { ...ringkasKoridor(line), garis: line.jalur?.coordinates || [], halte } });
  });

  // Halte terdekat dari satu titik, beserta koridor yang lewat.
  r.get('/stops', async (req, res) => {
    if (req.query.near === undefined) throw httpError(400, 'Parameter near (lat,lng) wajib diisi');
    const titik = wajibDalamWilayah(parseLatLng(req.query.near, 'Parameter near'));
    const radius = bacaRadius(req.query.radius);

    const stops = await TransitStop.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [titik.lng, titik.lat] },
          distanceField: 'jarakM',
          maxDistance: radius,
          spherical: true,
          key: 'lokasi',
        },
      },
      { $limit: HALTE_MAKS },
      { $project: { nama: 1, lokasi: 1, lines: 1, jarakM: 1 } },
    ]);

    const ids = [...new Set(stops.flatMap((s) => (s.lines || []).map((l) => String(l.line))))];
    const lines = await TransitLine.find({ _id: { $in: ids }, aktif: { $ne: false } }, 'kode nama jenis operator warna tarif tarifSumber').lean();
    const per = new Map(lines.map((l) => [String(l._id), l]));

    res.json({
      items: stops.map((s) => {
        const koridor = [];
        for (const l of s.lines || []) {
          const k = per.get(String(l.line));
          if (k && !koridor.some((x) => x.kode === k.kode)) {
            koridor.push({ kode: k.kode, nama: k.nama, jenis: k.jenis, warna: k.warna ?? null, ...tarifKoridor(k) });
          }
        }
        return { id: String(s._id), nama: s.nama, lokasi: keLatLng(s.lokasi), jarakM: Math.round(s.jarakM), koridor };
      }),
    });
  });

  return r;
}
