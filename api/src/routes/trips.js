import express from 'express';
import mongoose from 'mongoose';
import Trip from '../models/Trip.js';
import { httpError } from '../lib/httpError.js';
import { str } from '../lib/validate.js';
import { wajibDalamWilayah } from '../lib/wilayah.js';
import { requireAuth } from '../middleware/auth.js';

export const MODA = ['driving', 'motorcycle', 'walking', 'transit'];
const LIMIT_MAKS = 50;

const angka = (v) => typeof v === 'number' && Number.isFinite(v);

// { nama, lokasi: { lat, lng } } → subdokumen Trip (GeoJSON [lng, lat]).
function bacaTempat(v, label) {
  if (!v || typeof v !== 'object') throw httpError(400, `${label} wajib diisi`);
  const nama = str(v.nama);
  if (!nama) throw httpError(400, `Nama ${label.toLowerCase()} wajib diisi`);
  if (nama.length > 200) throw httpError(400, `Nama ${label.toLowerCase()} maksimal 200 karakter`);
  const { lat, lng } = v.lokasi || {};
  if (!angka(lat) || !angka(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw httpError(400, `Lokasi ${label.toLowerCase()} harus berupa {lat, lng}`);
  }
  wajibDalamWilayah({ lat, lng });
  return { nama, lokasi: { type: 'Point', coordinates: [lng, lat] } };
}

function bacaJudul(v) {
  if (v === null) return undefined;
  if (typeof v !== 'string') throw httpError(400, 'Judul harus berupa teks');
  const j = v.trim();
  if (j.length > 100) throw httpError(400, 'Judul maksimal 100 karakter');
  return j || undefined;
}

function bacaModa(v) {
  if (!MODA.includes(v)) throw httpError(400, `Moda harus salah satu dari: ${MODA.join(', ')}`);
  return v;
}

function bacaWaktu(v) {
  if (v === null || v === '') return undefined;
  const d = typeof v === 'string' ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) throw httpError(400, 'Waktu berangkat tidak valid');
  return d;
}

function bacaRingkasan(v) {
  if (v === null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) throw httpError(400, 'Ringkasan tidak valid');
  const out = {};
  for (const k of ['jarakM', 'durasiS', 'tarif']) {
    if (v[k] === undefined || v[k] === null) continue;
    if (!angka(v[k]) || v[k] < 0) throw httpError(400, `Ringkasan ${k} harus angka ≥ 0`);
    out[k] = k === 'tarif' ? Math.round(v[k]) : v[k];
  }
  return Object.keys(out).length ? out : undefined;
}

const tampilTempat = (t) => ({
  nama: t.nama,
  lokasi: { lat: t.lokasi.coordinates[1], lng: t.lokasi.coordinates[0] },
});

export function publicTrip(t) {
  const r = t.ringkasan || {};
  const ringkasan = {};
  for (const k of ['jarakM', 'durasiS', 'tarif']) if (r[k] !== undefined && r[k] !== null) ringkasan[k] = r[k];
  return {
    id: t.id,
    judul: t.judul ?? null,
    asal: tampilTempat(t.asal),
    tujuan: tampilTempat(t.tujuan),
    moda: t.moda,
    berangkatPada: t.berangkatPada ?? null,
    ringkasan: Object.keys(ringkasan).length ? ringkasan : null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function bilanganBulat(v, bawaan, min, maks) {
  if (v === undefined) return bawaan;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw httpError(400, 'Parameter halaman tidak valid');
  return Math.min(n, maks);
}

// Trip orang lain dijawab 404 (sama seperti tidak ada) supaya keberadaannya tidak bocor.
async function milikSendiri(req) {
  const { id } = req.params;
  const trip = mongoose.isValidObjectId(id) ? await Trip.findOne({ _id: id, user: req.user._id }) : null;
  if (!trip) throw httpError(404, 'Rencana perjalanan tidak ditemukan');
  return trip;
}

export function tripsRouter() {
  const r = express.Router();
  r.use(requireAuth);

  r.get('/', async (req, res) => {
    const page = bilanganBulat(req.query.page, 1, 1, 10_000);
    const limit = bilanganBulat(req.query.limit, 20, 1, LIMIT_MAKS);
    const filter = { user: req.user._id };
    const [items, total] = await Promise.all([
      Trip.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Trip.countDocuments(filter),
    ]);
    res.json({ items: items.map(publicTrip), page, total });
  });

  r.post('/', async (req, res) => {
    const b = req.body || {};
    const trip = await Trip.create({
      user: req.user._id,
      judul: b.judul === undefined ? undefined : bacaJudul(b.judul),
      asal: bacaTempat(b.asal, 'Asal'),
      tujuan: bacaTempat(b.tujuan, 'Tujuan'),
      moda: bacaModa(b.moda),
      berangkatPada: b.berangkatPada === undefined ? undefined : bacaWaktu(b.berangkatPada),
      ringkasan: b.ringkasan === undefined ? undefined : bacaRingkasan(b.ringkasan),
    });
    res.status(201).json({ trip: publicTrip(trip) });
  });

  r.get('/:id', async (req, res) => {
    res.json({ trip: publicTrip(await milikSendiri(req)) });
  });

  // Ubah sebagian; `null` mengosongkan field opsional (judul, berangkatPada, ringkasan).
  r.patch('/:id', async (req, res) => {
    const trip = await milikSendiri(req);
    const b = req.body || {};
    if (b.judul !== undefined) trip.judul = bacaJudul(b.judul);
    if (b.asal !== undefined) trip.asal = bacaTempat(b.asal, 'Asal');
    if (b.tujuan !== undefined) trip.tujuan = bacaTempat(b.tujuan, 'Tujuan');
    if (b.moda !== undefined) trip.moda = bacaModa(b.moda);
    if (b.berangkatPada !== undefined) trip.berangkatPada = bacaWaktu(b.berangkatPada);
    if (b.ringkasan !== undefined) trip.ringkasan = bacaRingkasan(b.ringkasan);
    await trip.save();
    res.json({ trip: publicTrip(trip) });
  });

  r.delete('/:id', async (req, res) => {
    const trip = await milikSendiri(req);
    await trip.deleteOne();
    res.status(204).end();
  });

  return r;
}
