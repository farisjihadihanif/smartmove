import express from 'express';
import TransitLine from '../../models/TransitLine.js';
import TransitStop from '../../models/TransitStop.js';
import { httpError } from '../../lib/httpError.js';
import { golonganTarif, tarifKoridor } from '../../services/tarif.js';
import { bersih, bilangan, bool, garis, keTitik, pilihan, teks, titik, wajibId } from './bantu.js';

// Admin koridor & halte transit (T-208). Data utama dari OSM (`npm run impor:osm`);
// admin hanya membetulkan. Aturan supaya impor ulang tidak menimpa koreksi:
// - mengubah kolom dari OSM (nama, jenis, operator, warna, jamOperasi, jalur) atau
//   daftar halte koridor → `dikoreksiAdmin: true`;
// - tarif yang diisi admin → `tarifSumber: 'admin'` (label "Tarif perkiraan" hilang);
// - koridor OSM tidak dihapus, cukup disembunyikan (`aktif: false`).

const JENIS = ['bus', 'kereta', 'angkot'];
const KOLOM_OSM = ['nama', 'jenis', 'operator', 'warna', 'jamOperasi', 'jalur'];

function koridorAdmin(l, jumlahHalte = 0) {
  const t = tarifKoridor(l);
  return {
    id: String(l._id),
    kode: l.kode,
    nama: l.nama,
    jenis: l.jenis,
    operator: l.operator ?? null,
    warna: l.warna ?? null,
    tarifAdmin: l.tarif ?? null,
    tarifSumber: l.tarifSumber ?? null,
    tarif: t.tarif,
    tarifPerkiraan: t.tarifPerkiraan,
    kecepatanRataKmj: l.kecepatanRataKmj,
    jamOperasi: l.jamOperasi ?? null,
    sumber: l.sumber,
    osmId: l.osmId ?? null,
    dikoreksiAdmin: Boolean(l.dikoreksiAdmin),
    aktif: l.aktif !== false,
    jumlahHalte,
    // Trans Metro Deli yang di OSM tercatat angkot: minta admin memeriksa `jenis`.
    periksaJenis: l.jenis === 'angkot' && golonganTarif(l) === 'bus_listrik',
    diperbaruiPada: l.diperbaruiPada,
  };
}

function halteAdmin(s, lineId) {
  const anggota = (s.lines || []).find((x) => String(x.line) === String(lineId));
  return {
    id: String(s._id),
    nama: s.nama,
    lokasi: keTitik(s.lokasi),
    urutan: anggota?.urutan ?? null,
    sumber: s.sumber,
    dikoreksiAdmin: Boolean(s.dikoreksiAdmin),
    jumlahKoridor: (s.lines || []).length,
  };
}

function bacaKoridor(b, { baru = false } = {}) {
  const warna = b.warna === undefined ? undefined : b.warna === null || b.warna === '' ? null : b.warna;
  if (warna && !/^#[0-9a-fA-F]{6}$/.test(warna)) throw httpError(400, 'Warna harus berformat #RRGGBB');
  return bersih({
    kode: baru ? teks(b.kode, 'Kode', { wajib: true, maks: 40 })?.toUpperCase() : undefined,
    nama: teks(b.nama, 'Nama', { wajib: baru, maks: 150 }),
    jenis: baru ? pilihan(b.jenis ?? '', 'Jenis', JENIS) : pilihan(b.jenis, 'Jenis', JENIS),
    operator: teks(b.operator, 'Operator', { maks: 100 }),
    warna,
    tarif: bilangan(b.tarif, 'Tarif', { maks: 1_000_000, bulat: true, bolehNull: true }),
    kecepatanRataKmj: bilangan(b.kecepatanRataKmj, 'Kecepatan rata-rata', { min: 1, maks: 120 }),
    jamOperasi: teks(b.jamOperasi, 'Jam operasi', { maks: 40 }),
    aktif: bool(b.aktif, 'Aktif'),
    jalur: garis(b.garis, 'Garis koridor'),
  });
}

async function jumlahHalte(ids) {
  const rows = await TransitStop.aggregate([
    { $match: { 'lines.line': { $in: ids } } },
    { $unwind: '$lines' },
    { $match: { 'lines.line': { $in: ids } } },
    { $group: { _id: '$lines.line', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

/** Koridor ini dikunci dari impor OSM (halte/geometri diubah admin). */
const kunciKoridor = (id) =>
  TransitLine.updateOne({ _id: id, sumber: 'osm' }, { $set: { dikoreksiAdmin: true, diperbaruiPada: new Date() } });

export function adminTransitRouter() {
  const r = express.Router();

  // GET /admin/transit/lines?q=&jenis=&aktif=true|false&periksa=jenis|tarif
  r.get('/lines', async (req, res) => {
    const f = {};
    if (req.query.jenis) f.jenis = pilihan(req.query.jenis, 'Jenis', JENIS);
    if (req.query.aktif === 'true') f.aktif = { $ne: false };
    if (req.query.aktif === 'false') f.aktif = false;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      f.$or = [{ kode: re }, { nama: re }, { operator: re }];
    }
    const lines = await TransitLine.find(f, '-jalur').sort({ jenis: 1, kode: 1 }).lean();
    const n = await jumlahHalte(lines.map((l) => l._id));
    let items = lines.map((l) => koridorAdmin(l, n.get(String(l._id)) ?? 0));
    if (req.query.periksa === 'jenis') items = items.filter((l) => l.periksaJenis);
    if (req.query.periksa === 'tarif') items = items.filter((l) => l.tarifSumber !== 'admin' && l.jenis !== 'kereta');
    res.json({ items });
  });

  r.get('/lines/:id', async (req, res) => {
    const l = await TransitLine.findById(wajibId(req.params.id, 'Koridor')).lean();
    if (!l) throw httpError(404, 'Koridor tidak ditemukan');
    const halte = await TransitStop.find({ 'lines.line': l._id }).lean();
    const items = halte.map((s) => halteAdmin(s, l._id)).sort((a, b) => a.urutan - b.urutan);
    res.json({ line: { ...koridorAdmin(l, items.length), garis: l.jalur?.coordinates ?? [], halte: items } });
  });

  r.post('/lines', async (req, res) => {
    const data = bacaKoridor(req.body || {}, { baru: true });
    if (await TransitLine.exists({ kode: data.kode })) throw httpError(409, 'Kode koridor sudah dipakai');
    if (data.tarif !== undefined) data.tarifSumber = data.tarif === null ? null : 'admin';
    const l = await TransitLine.create({ ...data, sumber: 'admin', diperbaruiPada: new Date() });
    res.status(201).json({ line: koridorAdmin(l.toObject()) });
  });

  r.patch('/lines/:id', async (req, res) => {
    const l = await TransitLine.findById(wajibId(req.params.id, 'Koridor'));
    if (!l) throw httpError(404, 'Koridor tidak ditemukan');
    const data = bacaKoridor(req.body || {});
    const ubahOsm = KOLOM_OSM.some((k) => data[k] !== undefined);
    if (data.tarif !== undefined) data.tarifSumber = data.tarif === null ? null : 'admin';
    if (data.nama === '') throw httpError(400, 'Nama wajib diisi');
    // Teks kosong / null = hapus isian (kecuali tarif: null berarti "belum diisi").
    for (const [k, v] of Object.entries(data)) {
      l.set(k, v === '' || (v === null && k !== 'tarif' && k !== 'tarifSumber') ? undefined : v);
    }
    if (ubahOsm && l.sumber === 'osm') l.dikoreksiAdmin = true;
    // "Kembalikan ke OSM": impor berikutnya boleh menimpa lagi.
    if (req.body?.kembalikanOsm === true && l.sumber === 'osm') l.dikoreksiAdmin = false;
    l.diperbaruiPada = new Date();
    await l.save();
    const n = await jumlahHalte([l._id]);
    res.json({ line: koridorAdmin(l.toObject(), n.get(String(l._id)) ?? 0) });
  });

  r.delete('/lines/:id', async (req, res) => {
    const l = await TransitLine.findById(wajibId(req.params.id, 'Koridor'));
    if (!l) throw httpError(404, 'Koridor tidak ditemukan');
    if (l.sumber === 'osm') {
      throw httpError(409, 'Koridor dari OpenStreetMap tidak dihapus agar tidak terimpor ulang. Sembunyikan saja (aktif: false).');
    }
    await TransitStop.updateMany({ 'lines.line': l._id }, { $pull: { lines: { line: l._id } } });
    await TransitStop.deleteMany({ sumber: 'admin', lines: { $size: 0 } });
    await l.deleteOne();
    res.status(204).end();
  });

  // POST /admin/transit/stops { nama, lokasi, line, urutan? } → halte baru di ujung (atau urutan tertentu).
  r.post('/stops', async (req, res) => {
    const body = req.body || {};
    const nama = teks(body.nama, 'Nama halte', { wajib: true, maks: 150 });
    const lokasi = titik(body.lokasi ?? undefined, 'Lokasi halte');
    if (!lokasi) throw httpError(400, 'Lokasi halte wajib diisi');
    const line = await TransitLine.findById(wajibId(body.line, 'Koridor'), '_id sumber').lean();
    if (!line) throw httpError(404, 'Koridor tidak ditemukan');
    let urutan = bilangan(body.urutan, 'Urutan', { bulat: true });
    if (urutan === undefined) {
      const akhir = await TransitStop.aggregate([
        { $match: { 'lines.line': line._id } },
        { $unwind: '$lines' },
        { $match: { 'lines.line': line._id } },
        { $group: { _id: null, maks: { $max: '$lines.urutan' } } },
      ]);
      urutan = akhir.length ? akhir[0].maks + 1 : 0;
    }
    const s = await TransitStop.create({ nama, lokasi, lines: [{ line: line._id, urutan }], sumber: 'admin' });
    await kunciKoridor(line._id);
    res.status(201).json({ halte: halteAdmin(s.toObject(), line._id) });
  });

  // PATCH /admin/transit/stops/:id { nama?, lokasi?, line?, urutan? } — `urutan` berlaku untuk koridor `line`.
  r.patch('/stops/:id', async (req, res) => {
    const s = await TransitStop.findById(wajibId(req.params.id, 'Halte'));
    if (!s) throw httpError(404, 'Halte tidak ditemukan');
    const body = req.body || {};
    const nama = teks(body.nama, 'Nama halte', { maks: 150 });
    if (nama === '') throw httpError(400, 'Nama halte wajib diisi');
    const lokasi = titik(body.lokasi, 'Lokasi halte');
    if (lokasi === null) throw httpError(400, 'Lokasi halte wajib diisi');
    const urutan = bilangan(body.urutan, 'Urutan', { bulat: true });
    if (nama !== undefined) s.nama = nama;
    if (lokasi) s.lokasi = lokasi;
    let lineId = null;
    if (urutan !== undefined) {
      lineId = wajibId(body.line, 'Koridor');
      const anggota = s.lines.find((x) => String(x.line) === String(lineId));
      if (!anggota) throw httpError(400, 'Halte ini tidak ada di koridor tersebut');
      anggota.urutan = urutan;
    }
    if (s.sumber === 'osm') s.dikoreksiAdmin = true;
    await s.save();
    if (lineId) await kunciKoridor(lineId);
    res.json({ halte: halteAdmin(s.toObject(), lineId ?? s.lines[0]?.line) });
  });

  // DELETE /admin/transit/stops/:id?line= — lepas dari koridor `line` (atau semua koridor bila kosong).
  // Halte buatan admin yang tidak punya koridor lagi dihapus; halte OSM dikunci supaya tidak kembali.
  r.delete('/stops/:id', async (req, res) => {
    const s = await TransitStop.findById(wajibId(req.params.id, 'Halte'));
    if (!s) throw httpError(404, 'Halte tidak ditemukan');
    const lineId = req.query.line ? wajibId(req.query.line, 'Koridor') : null;
    const dilepas = s.lines.filter((x) => !lineId || String(x.line) === String(lineId)).map((x) => x.line);
    s.lines = s.lines.filter((x) => lineId && String(x.line) !== String(lineId));
    for (const id of dilepas) await kunciKoridor(id);
    if (!s.lines.length && s.sumber === 'admin') {
      await s.deleteOne();
    } else {
      if (s.sumber === 'osm') s.dikoreksiAdmin = true;
      await s.save();
    }
    res.status(204).end();
  });

  return r;
}

