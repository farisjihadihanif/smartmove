import express from 'express';
import Content from '../../models/Content.js';
import Event from '../../models/Event.js';
import RoadCorridor from '../../models/RoadCorridor.js';
import { jenisGambar, terimaGambar } from '../../lib/gambar.js';
import { httpError } from '../../lib/httpError.js';
import { eventPublik, JENIS_KONTEN, kontenPublik } from '../../services/campaign.js';
import { BERKAS_PREFIX, hapusBerkas, simpanBerkas } from '../../services/berkas.js';
import { panjangGaris } from '../../services/roadCorridors.js';
import { bersih, bilangan, bool, garis, paginasi, pilihan, teks, titik, waktu, wajibId } from './bantu.js';

// Admin jalan utama (koreksi geometri OSM), EventAlert, dan konten kampanye (T-208).

export const POSTER_PREFIX = BERKAS_PREFIX; // GridFS (services/berkas.js)
export const POSTER_MAX_BYTES = 3 * 1024 * 1024;
const JENIS_EVENT = ['cfd', 'rekayasa_arus', 'acara', 'lainnya'];

const jalanAdmin = (k) => ({
  kode: k.kode,
  nama: k.nama,
  urutan: k.urutan,
  garis: k.jalur?.coordinates ?? [],
  panjangM: Math.round(k.panjangM),
  namaOsm: k.namaOsm ?? [],
  sumber: k.sumber,
  dikoreksiAdmin: Boolean(k.dikoreksiAdmin),
  aktif: k.aktif !== false,
  diperbaruiPada: k.diperbaruiPada,
});

const eventAdmin = (e, now = Date.now()) => ({
  ...eventPublik(e, now),
  status: new Date(e.selesai).getTime() < now ? 'selesai' : eventPublik(e, now).status,
  createdAt: e.createdAt,
});

const kontenAdmin = (c) => ({ ...kontenPublik(c), aktif: c.aktif !== false, createdAt: c.createdAt });

// Isian multipart selalu teks: ubah "true"/"false" dan angka ke tipe aslinya.
function dariForm(req) {
  const b = { ...(req.body || {}) };
  if (!req.is('multipart/form-data')) return b;
  if (b.aktif !== undefined) b.aktif = b.aktif === 'true' ? true : b.aktif === 'false' ? false : b.aktif;
  if (b.urutan !== undefined && b.urutan !== '') b.urutan = Number(b.urutan);
  return b;
}

export function adminKontenRouter(cfg) {
  const r = express.Router();
  const terimaPoster = terimaGambar('gambar', { maxBytes: POSTER_MAX_BYTES, label: 'gambar' });

  async function simpanGambar(file) {
    const ext = jenisGambar(file.buffer);
    if (!ext) throw httpError(400, 'Gambar harus berupa JPG, PNG, atau WEBP');
    return simpanBerkas(file.buffer, { ext, folder: 'campaign' });
  }
  const hapusGambar = (p) => hapusBerkas(p, { uploadDir: cfg.uploadDir });

  // ── Jalan utama (RoadCorridor) ──
  r.get('/road-corridors', async (req, res) => {
    const items = await RoadCorridor.find().sort({ urutan: 1, kode: 1 }).lean();
    res.json({ items: items.map(jalanAdmin) });
  });

  // PATCH /admin/road-corridors/:kode { nama?, urutan?, aktif?, garis?, kembalikanOsm? }
  // Garis baru → sumber admin + dikunci dari impor ulang; `kembalikanOsm: true` membuka kuncinya.
  r.patch('/road-corridors/:kode', async (req, res) => {
    const k = await RoadCorridor.findOne({ kode: String(req.params.kode).toUpperCase() });
    if (!k) throw httpError(404, 'Jalan utama tidak ditemukan');
    const b = req.body || {};
    const data = bersih({
      nama: teks(b.nama, 'Nama', { maks: 100 }),
      urutan: bilangan(b.urutan, 'Urutan', { bulat: true, maks: 1000 }),
      aktif: bool(b.aktif, 'Aktif'),
      jalur: garis(b.garis, 'Garis jalan'),
    });
    if (data.nama === '') throw httpError(400, 'Nama wajib diisi');
    Object.assign(k, data);
    if (data.jalur) {
      k.panjangM = panjangGaris(data.jalur.coordinates);
      k.sumber = 'admin';
      k.dikoreksiAdmin = true;
    }
    if (b.kembalikanOsm === true) k.dikoreksiAdmin = false;
    // Versi cache estimasi waktu ikut berganti (services/trafficProvider.js).
    k.diperbaruiPada = new Date();
    await k.save();
    res.json({ koridor: jalanAdmin(k.toObject()) });
  });

  // ── EventAlert ──
  // GET /admin/events?status=aktif|selesai|semua&page=&limit=
  r.get('/events', async (req, res) => {
    const { page, limit, skip } = paginasi(req.query);
    const now = new Date();
    const status = req.query.status ?? 'aktif';
    const f = status === 'aktif' ? { selesai: { $gte: now } } : status === 'selesai' ? { selesai: { $lt: now } } : {};
    const [items, total] = await Promise.all([
      Event.find(f)
        .sort(status === 'selesai' ? { mulai: -1 } : { mulai: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Event.countDocuments(f),
    ]);
    res.json({ items: items.map((e) => eventAdmin(e, now.getTime())), page, total });
  });

  function bacaEvent(b, baru) {
    const data = bersih({
      judul: teks(b.judul, 'Judul', { wajib: baru, maks: 150 }),
      isi: teks(b.isi, 'Isi', { wajib: baru, maks: 2000 }),
      jenis: pilihan(b.jenis, 'Jenis', JENIS_EVENT),
      mulai: waktu(b.mulai, 'Waktu mulai'),
      selesai: waktu(b.selesai, 'Waktu selesai'),
      lokasi: titik(b.lokasi, 'Lokasi event'),
    });
    if (data.judul === '') throw httpError(400, 'Judul wajib diisi');
    if (data.isi === '') throw httpError(400, 'Isi wajib diisi');
    if (baru && (!data.mulai || !data.selesai)) throw httpError(400, 'Waktu mulai dan selesai wajib diisi');
    return data;
  }
  const cekRentang = (e) => {
    if (e.selesai < e.mulai) throw httpError(400, 'Waktu selesai harus setelah waktu mulai');
  };

  r.post('/events', async (req, res) => {
    const data = bacaEvent(req.body || {}, true);
    cekRentang(data);
    const e = await Event.create({ ...data, lokasi: data.lokasi ?? undefined });
    res.status(201).json({ event: eventAdmin(e.toObject()) });
  });

  r.patch('/events/:id', async (req, res) => {
    const e = await Event.findById(wajibId(req.params.id, 'Event'));
    if (!e) throw httpError(404, 'Event tidak ditemukan');
    const data = bacaEvent(req.body || {}, false);
    for (const [k, v] of Object.entries(data)) e.set(k, v === null ? undefined : v);
    cekRentang(e);
    await e.save();
    res.json({ event: eventAdmin(e.toObject()) });
  });

  r.delete('/events/:id', async (req, res) => {
    const e = await Event.findByIdAndDelete(wajibId(req.params.id, 'Event'));
    if (!e) throw httpError(404, 'Event tidak ditemukan');
    res.status(204).end();
  });

  // ── Konten (tips & poster) ──
  r.get('/contents', async (req, res) => {
    const f = req.query.jenis ? { jenis: pilihan(req.query.jenis, 'Jenis', JENIS_KONTEN) } : {};
    const items = await Content.find(f).sort({ jenis: 1, urutan: 1, createdAt: 1 }).lean();
    res.json({ items: items.map(kontenAdmin) });
  });

  function bacaKonten(b, baru) {
    const data = bersih({
      jenis: baru ? pilihan(b.jenis ?? '', 'Jenis', JENIS_KONTEN) : undefined,
      judul: teks(b.judul, 'Judul', { wajib: baru, maks: 150 }),
      isi: teks(b.isi, 'Isi', { maks: 2000 }),
      urutan: bilangan(b.urutan, 'Urutan', { bulat: true, maks: 10000 }),
      aktif: bool(b.aktif, 'Aktif'),
    });
    if (data.judul === '') throw httpError(400, 'Judul wajib diisi');
    return data;
  }

  // Multipart dengan berkas `gambar` (wajib untuk poster) atau JSON.
  r.post('/contents', terimaPoster, async (req, res) => {
    const data = bacaKonten(dariForm(req), true);
    if (data.jenis === 'poster' && !req.file) throw httpError(400, 'Poster wajib punya gambar');
    const gambar = req.file ? await simpanGambar(req.file) : undefined;
    try {
      const c = await Content.create({ ...data, isi: data.isi || undefined, gambar });
      res.status(201).json({ konten: kontenAdmin(c.toObject()) });
    } catch (err) {
      await hapusGambar(gambar);
      throw err;
    }
  });

  r.patch('/contents/:id', terimaPoster, async (req, res) => {
    const c = await Content.findById(wajibId(req.params.id, 'Konten'));
    if (!c) throw httpError(404, 'Konten tidak ditemukan');
    const data = bacaKonten(dariForm(req), false);
    for (const [k, v] of Object.entries(data)) c.set(k, v === '' ? undefined : v);
    const lama = c.gambar;
    if (req.file) c.gambar = await simpanGambar(req.file);
    await c.save();
    if (req.file) await hapusGambar(lama);
    res.json({ konten: kontenAdmin(c.toObject()) });
  });

  r.delete('/contents/:id', async (req, res) => {
    const c = await Content.findByIdAndDelete(wajibId(req.params.id, 'Konten'));
    if (!c) throw httpError(404, 'Konten tidak ditemukan');
    await hapusGambar(c.gambar);
    res.status(204).end();
  });

  return r;
}

