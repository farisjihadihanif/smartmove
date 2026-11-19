import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import TransitLine from '../src/models/TransitLine.js';
import TransitStop from '../src/models/TransitStop.js';
import RoadCorridor from '../src/models/RoadCorridor.js';
import Event from '../src/models/Event.js';
import Content from '../src/models/Content.js';
import Feedback from '../src/models/Feedback.js';
import TrafficReport from '../src/models/TrafficReport.js';
import Trip from '../src/models/Trip.js';

process.env.NODE_ENV = 'test';
let mongod;
let app;
let uploadDir;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), TransitLine.init(), TransitStop.init(), RoadCorridor.init(), Event.init()]);
  uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smartmove-admin-'));
  app = createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailMode: 'console',
    mailer: { send: async () => {} },
    authRateLimit: { windowMs: 60_000, limit: 1000 },
    uploadDir,
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  await fs.rm(uploadDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await Promise.all(
    [User, TransitLine, TransitStop, RoadCorridor, Event, Content, Feedback, TrafficReport, Trip].map((m) => m.deleteMany({})),
  );
});

async function daftar(username, { admin = false } = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@contoh.id`, password: 'rahasia123', role: 'admin' });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'user'); // registrasi publik selalu user
  if (admin) await User.updateOne({ username }, { role: 'admin' });
  return { auth: `Bearer ${res.body.token}`, id: res.body.user.id };
}

const GARIS = [
  [98.6, 3.59],
  [98.65, 3.59],
  [98.67, 3.6],
];

describe('akses admin', () => {
  test('tamu 401, pengguna biasa 403, admin 200', async () => {
    assert.equal((await request(app).get('/api/admin/stats')).status, 401);
    const u = await daftar('warga');
    assert.equal((await request(app).get('/api/admin/stats').set('Authorization', u.auth)).status, 403);
    const a = await daftar('pengelola', { admin: true });
    const res = await request(app).get('/api/admin/stats').set('Authorization', a.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.pengguna.total, 2);
    assert.equal(res.body.pengguna.admin, 1);
  });
});

describe('koridor transit', () => {
  test('tarif admin → tarifSumber admin & tidak lagi perkiraan; TMD bertanda angkot ditandai', async () => {
    const a = await daftar('admin1', { admin: true });
    const l = await TransitLine.create({
      kode: 'TMD-K1',
      nama: 'Trans Metro Deli K1',
      jenis: 'angkot',
      sumber: 'osm',
      osmId: 'relation/1',
      jalur: { type: 'LineString', coordinates: GARIS },
    });

    const daftarRes = await request(app).get('/api/admin/transit/lines?periksa=jenis').set('Authorization', a.auth);
    assert.equal(daftarRes.body.items.length, 1);
    assert.equal(daftarRes.body.items[0].periksaJenis, true);
    assert.equal(daftarRes.body.items[0].tarifPerkiraan, true);

    const tarif = await request(app).patch(`/api/admin/transit/lines/${l.id}`).set('Authorization', a.auth).send({ tarif: 5000 });
    assert.equal(tarif.status, 200);
    assert.equal(tarif.body.line.tarifSumber, 'admin');
    assert.equal(tarif.body.line.tarifPerkiraan, false);
    assert.equal(tarif.body.line.dikoreksiAdmin, false); // tarif tidak ditimpa impor, jadi tak perlu dikunci

    const jenis = await request(app).patch(`/api/admin/transit/lines/${l.id}`).set('Authorization', a.auth).send({ jenis: 'bus' });
    assert.equal(jenis.body.line.jenis, 'bus');
    assert.equal(jenis.body.line.periksaJenis, false);
    assert.equal(jenis.body.line.dikoreksiAdmin, true);

    // Publik ikut berubah.
    const pub = await request(app).get('/api/transit/lines/TMD-K1');
    assert.equal(pub.body.line.tarif, 5000);
    assert.equal(pub.body.line.tarifPerkiraan, false);

    const kosong = await request(app).patch(`/api/admin/transit/lines/${l.id}`).set('Authorization', a.auth).send({ tarif: null });
    assert.equal(kosong.body.line.tarifSumber, null);
  });

  test('koridor OSM tidak bisa dihapus (409), disembunyikan saja; buatan admin bisa', async () => {
    const a = await daftar('admin2', { admin: true });
    const osm = await TransitLine.create({ kode: 'ANGKOT-1', nama: 'A', jenis: 'angkot', sumber: 'osm', osmId: 'relation/2' });
    const del = await request(app).delete(`/api/admin/transit/lines/${osm.id}`).set('Authorization', a.auth);
    assert.equal(del.status, 409);
    const sembunyi = await request(app).patch(`/api/admin/transit/lines/${osm.id}`).set('Authorization', a.auth).send({ aktif: false });
    assert.equal(sembunyi.body.line.aktif, false);
    const pub = await request(app).get('/api/transit/lines');
    assert.equal(pub.body.items.length, 0);

    const buat = await request(app)
      .post('/api/admin/transit/lines')
      .set('Authorization', a.auth)
      .send({ kode: 'bus-baru', nama: 'Bus Baru', jenis: 'bus', tarif: 4000, garis: GARIS });
    assert.equal(buat.status, 201);
    assert.equal(buat.body.line.kode, 'BUS-BARU');
    assert.equal(buat.body.line.tarifSumber, 'admin');
    const dup = await request(app).post('/api/admin/transit/lines').set('Authorization', a.auth).send({ kode: 'BUS-BARU', nama: 'x', jenis: 'bus' });
    assert.equal(dup.status, 409);
    assert.equal((await request(app).delete(`/api/admin/transit/lines/${buat.body.line.id}`).set('Authorization', a.auth)).status, 204);
  });

  test('halte: tambah di ujung, ubah urutan/lokasi, lepas → koridor & halte OSM dikunci', async () => {
    const a = await daftar('admin3', { admin: true });
    const l = await TransitLine.create({ kode: 'TMD-K2', nama: 'K2', jenis: 'bus', sumber: 'osm', osmId: 'relation/3' });
    const osmHalte = await TransitStop.create({
      nama: 'Halte OSM',
      lokasi: { type: 'Point', coordinates: [98.6, 3.59] },
      lines: [{ line: l._id, urutan: 0 }],
      sumber: 'osm',
      osmId: 'node/9',
    });

    const tambah = await request(app)
      .post('/api/admin/transit/stops')
      .set('Authorization', a.auth)
      .send({ nama: 'Halte Baru', lokasi: { lat: 3.6, lng: 98.67 }, line: l.id });
    assert.equal(tambah.status, 201);
    assert.equal(tambah.body.halte.urutan, 1);
    assert.equal((await TransitLine.findById(l._id)).dikoreksiAdmin, true);

    const luar = await request(app)
      .post('/api/admin/transit/stops')
      .set('Authorization', a.auth)
      .send({ nama: 'Jakarta', lokasi: { lat: -6.2, lng: 106.8 }, line: l.id });
    assert.equal(luar.status, 422);

    const ubah = await request(app)
      .patch(`/api/admin/transit/stops/${osmHalte.id}`)
      .set('Authorization', a.auth)
      .send({ lokasi: { lat: 3.591, lng: 98.601 }, line: l.id, urutan: 2 });
    assert.equal(ubah.status, 200);
    assert.deepEqual(ubah.body.halte.lokasi, { lat: 3.591, lng: 98.601 });
    assert.equal(ubah.body.halte.urutan, 2);
    assert.equal(ubah.body.halte.dikoreksiAdmin, true);

    const detail = await request(app).get(`/api/admin/transit/lines/${l.id}`).set('Authorization', a.auth);
    assert.deepEqual(
      detail.body.line.halte.map((h) => h.nama),
      ['Halte Baru', 'Halte OSM'],
    );

    // Lepas halte buatan admin → dokumen terhapus; halte OSM → tetap ada tapi tanpa koridor & dikunci.
    await request(app).delete(`/api/admin/transit/stops/${tambah.body.halte.id}?line=${l.id}`).set('Authorization', a.auth).expect(204);
    assert.equal(await TransitStop.countDocuments({ _id: tambah.body.halte.id }), 0);
    await request(app).delete(`/api/admin/transit/stops/${osmHalte.id}?line=${l.id}`).set('Authorization', a.auth).expect(204);
    const sisa = await TransitStop.findById(osmHalte._id);
    assert.equal(sisa.lines.length, 0);
    assert.equal(sisa.dikoreksiAdmin, true);
  });
});

describe('jalan utama', () => {
  test('garis baru → sumber admin, dikunci, panjang dihitung ulang; kembalikan ke OSM', async () => {
    const a = await daftar('admin4', { admin: true });
    await RoadCorridor.create({
      kode: 'GATSU',
      nama: 'Jl. Gatot Subroto',
      jalur: { type: 'LineString', coordinates: [[98.6, 3.59], [98.61, 3.59]] },
      panjangM: 1111,
    });
    const res = await request(app).patch('/api/admin/road-corridors/gatsu').set('Authorization', a.auth).send({ garis: GARIS });
    assert.equal(res.status, 200);
    assert.equal(res.body.koridor.sumber, 'admin');
    assert.equal(res.body.koridor.dikoreksiAdmin, true);
    assert.ok(res.body.koridor.panjangM > 7000);
    assert.equal(res.body.koridor.garis.length, 3);

    const satu = await request(app).patch('/api/admin/road-corridors/GATSU').set('Authorization', a.auth).send({ garis: [[98.6, 3.59]] });
    assert.equal(satu.status, 400);

    const sembunyi = await request(app)
      .patch('/api/admin/road-corridors/GATSU')
      .set('Authorization', a.auth)
      .send({ aktif: false, kembalikanOsm: true });
    assert.equal(sembunyi.body.koridor.aktif, false);
    assert.equal(sembunyi.body.koridor.dikoreksiAdmin, false);
    assert.equal((await request(app).get('/api/admin/road-corridors').set('Authorization', a.auth)).body.items.length, 1);
  });
});

describe('event & konten', () => {
  test('CRUD event dengan lokasi opsional dan validasi rentang', async () => {
    const a = await daftar('admin5', { admin: true });
    const mulai = new Date(Date.now() + 3600e3).toISOString();
    const selesai = new Date(Date.now() + 7200e3).toISOString();
    const buat = await request(app)
      .post('/api/admin/events')
      .set('Authorization', a.auth)
      .send({ judul: 'CFD', isi: 'Jalan ditutup', jenis: 'cfd', mulai, selesai, lokasi: { lat: 3.5844, lng: 98.6789 } });
    assert.equal(buat.status, 201);
    assert.deepEqual(buat.body.event.lokasi, { lat: 3.5844, lng: 98.6789 });

    const salah = await request(app).post('/api/admin/events').set('Authorization', a.auth).send({ judul: 'x', isi: 'x', mulai: selesai, selesai: mulai });
    assert.equal(salah.status, 400);

    const tanpaLokasi = await request(app).patch(`/api/admin/events/${buat.body.event.id}`).set('Authorization', a.auth).send({ lokasi: null });
    assert.equal(tanpaLokasi.body.event.lokasi, null);

    const list = await request(app).get('/api/admin/events').set('Authorization', a.auth);
    assert.equal(list.body.total, 1);
    assert.equal((await request(app).get('/api/campaign/events')).body.items.length, 1);
    await request(app).delete(`/api/admin/events/${buat.body.event.id}`).set('Authorization', a.auth).expect(204);
  });

  test('poster wajib gambar; unggah, ganti, hapus berkas', async () => {
    const a = await daftar('admin6', { admin: true });
    const tanpa = await request(app).post('/api/admin/contents').set('Authorization', a.auth).send({ jenis: 'poster', judul: 'Helm' });
    assert.equal(tanpa.status, 400);

    const bukan = await request(app)
      .post('/api/admin/contents')
      .set('Authorization', a.auth)
      .field('jenis', 'poster')
      .field('judul', 'Helm')
      .attach('gambar', Buffer.from('bukan gambar'), 'x.png');
    assert.equal(bukan.status, 400);

    const buat = await request(app)
      .post('/api/admin/contents')
      .set('Authorization', a.auth)
      .field('jenis', 'poster')
      .field('judul', 'Pakai helm')
      .field('urutan', '2')
      .field('aktif', 'true')
      .attach('gambar', PNG, 'helm.png');
    assert.equal(buat.status, 201);
    const g1 = buat.body.konten.gambar;
    assert.match(g1, /^\/uploads\/campaign\/.+\.png$/);
    assert.equal(buat.body.konten.urutan, 2);
    await fs.access(path.join(uploadDir, 'campaign', path.basename(g1)));

    const ganti = await request(app)
      .patch(`/api/admin/contents/${buat.body.konten.id}`)
      .set('Authorization', a.auth)
      .field('aktif', 'false')
      .attach('gambar', PNG, 'baru.png');
    assert.equal(ganti.status, 200);
    assert.equal(ganti.body.konten.aktif, false);
    assert.notEqual(ganti.body.konten.gambar, g1);
    await assert.rejects(fs.access(path.join(uploadDir, 'campaign', path.basename(g1))));
    assert.equal((await request(app).get('/api/campaign/contents?jenis=poster')).body.items.length, 0);

    await request(app).delete(`/api/admin/contents/${buat.body.konten.id}`).set('Authorization', a.auth).expect(204);
    await assert.rejects(fs.access(path.join(uploadDir, 'campaign', path.basename(ganti.body.konten.gambar))));
  });
});

describe('pengguna & moderasi', () => {
  test('ubah peran, tidak bisa mengubah/menghapus diri sendiri, hapus berikut datanya', async () => {
    const a = await daftar('admin7', { admin: true });
    const u = await daftar('budi');
    await Trip.create({
      user: u.id,
      asal: { nama: 'A', lokasi: { type: 'Point', coordinates: [98.6, 3.59] } },
      tujuan: { nama: 'B', lokasi: { type: 'Point', coordinates: [98.61, 3.59] } },
      moda: 'driving',
    });
    await Feedback.create({ user: u.id, rating: 5 });

    const cari = await request(app).get('/api/admin/users?q=bud').set('Authorization', a.auth);
    assert.equal(cari.body.total, 1);
    assert.equal(cari.body.items[0].password, undefined);

    assert.equal((await request(app).patch(`/api/admin/users/${a.id}`).set('Authorization', a.auth).send({ role: 'user' })).status, 400);
    assert.equal((await request(app).delete(`/api/admin/users/${a.id}`).set('Authorization', a.auth)).status, 400);

    const naik = await request(app).patch(`/api/admin/users/${u.id}`).set('Authorization', a.auth).send({ role: 'admin' });
    assert.equal(naik.body.user.role, 'admin');

    await request(app).delete(`/api/admin/users/${u.id}`).set('Authorization', a.auth).expect(204);
    assert.equal(await User.countDocuments({ username: 'budi' }), 0);
    assert.equal(await Trip.countDocuments({ user: u.id }), 0);
    assert.equal(await Feedback.countDocuments({ user: u.id }), 0);
  });

  test('moderasi laporan & umpan balik menampilkan pelapor dan bisa dihapus', async () => {
    const a = await daftar('admin8', { admin: true });
    const u = await daftar('sari');
    const lap = await TrafficReport.create({ user: u.id, lokasi: { type: 'Point', coordinates: [98.6, 3.59] }, tingkat: 'macet' });
    await TrafficReport.create({
      user: u.id,
      lokasi: { type: 'Point', coordinates: [98.6, 3.59] },
      tingkat: 'padat',
      expiresAt: new Date(Date.now() - 1000),
    });
    const fb = await Feedback.create({ user: u.id, rating: 2, komentar: 'Lambat' });

    const aktif = await request(app).get('/api/admin/traffic/reports').set('Authorization', a.auth);
    assert.equal(aktif.body.total, 1);
    assert.equal(aktif.body.items[0].pelapor.username, 'sari');
    assert.equal((await request(app).get('/api/admin/traffic/reports?status=semua').set('Authorization', a.auth)).body.total, 2);
    await request(app).delete(`/api/admin/traffic/reports/${lap.id}`).set('Authorization', a.auth).expect(204);

    const umpan = await request(app).get('/api/admin/feedback?rating=2').set('Authorization', a.auth);
    assert.equal(umpan.body.items[0].pengguna.username, 'sari');
    assert.equal(umpan.body.items[0].komentar, 'Lambat');
    const stats = await request(app).get('/api/admin/stats').set('Authorization', a.auth);
    assert.equal(stats.body.umpanBalik.rataRating, 2);
    await request(app).delete(`/api/admin/feedback/${fb.id}`).set('Authorization', a.auth).expect(204);
    assert.equal((await request(app).delete(`/api/admin/feedback/${fb.id}`).set('Authorization', a.auth)).status, 404);
    assert.equal((await request(app).delete('/api/admin/feedback/bukan-id').set('Authorization', a.auth)).status, 404);
  });
});
