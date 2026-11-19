import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import Content from '../src/models/Content.js';
import Event from '../src/models/Event.js';
import Feedback from '../src/models/Feedback.js';
import { BATAS_UMPAN_BALIK_PER_HARI } from '../src/services/campaign.js';

process.env.NODE_ENV = 'test';
let mongod;
let app;

const JAM = 60 * 60 * 1000;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Event.init()]);
  app = createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailMode: 'console',
    mailer: { send: async () => {} },
    authRateLimit: { windowMs: 60_000, limit: 1000 },
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Content.deleteMany({}), Event.deleteMany({}), Feedback.deleteMany({})]);
});

async function daftar(username) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@contoh.id`, password: 'rahasia123' });
  assert.equal(res.status, 201);
  return `Bearer ${res.body.token}`;
}

describe('GET /campaign/contents', () => {
  test('hanya konten aktif, urut `urutan`, bisa disaring jenis', async () => {
    await Content.create([
      { jenis: 'tips', judul: 'Pakai helm SNI', isi: 'Kencangkan tali helm.', urutan: 2 },
      { jenis: 'tips', judul: 'Jaga jarak aman', isi: 'Minimal 3 detik.', urutan: 1 },
      { jenis: 'tips', judul: 'Tips lama', isi: 'x', aktif: false },
      { jenis: 'poster', judul: 'Poster helm', gambar: '/uploads/campaign/helm.webp', urutan: 0 },
    ]);

    const semua = await request(app).get('/api/campaign/contents');
    assert.equal(semua.status, 200);
    assert.equal(semua.body.items.length, 3);

    const tips = await request(app).get('/api/campaign/contents?jenis=tips');
    assert.deepEqual(
      tips.body.items.map((c) => c.judul),
      ['Jaga jarak aman', 'Pakai helm SNI'],
    );
    const t = tips.body.items[0];
    assert.deepEqual(Object.keys(t).sort(), ['gambar', 'id', 'isi', 'jenis', 'judul', 'urutan']);
    assert.equal(t.gambar, null);

    const poster = await request(app).get('/api/campaign/contents?jenis=poster');
    assert.equal(poster.body.items.length, 1);
    assert.equal(poster.body.items[0].gambar, '/uploads/campaign/helm.webp');
  });

  test('jenis tidak dikenal → 400', async () => {
    const res = await request(app).get('/api/campaign/contents?jenis=video');
    assert.equal(res.status, 400);
    assert.match(res.body.message, /tips, poster/);
  });
});

describe('GET /campaign/events', () => {
  test('berlangsung dulu lalu mendatang; yang sudah selesai disembunyikan', async () => {
    const now = Date.now();
    await Event.create([
      {
        judul: 'CFD Jl. Pemuda',
        isi: 'Jalan ditutup untuk kendaraan.',
        jenis: 'cfd',
        mulai: new Date(now - JAM),
        selesai: new Date(now + JAM),
        lokasi: { type: 'Point', coordinates: [98.6789, 3.5844] },
      },
      { judul: 'Konser', isi: 'Pengalihan arus.', jenis: 'acara', mulai: new Date(now + 48 * JAM), selesai: new Date(now + 52 * JAM) },
      { judul: 'Rekayasa arus', isi: 'x', jenis: 'rekayasa_arus', mulai: new Date(now + 2 * JAM), selesai: new Date(now + 3 * JAM) },
      { judul: 'Sudah lewat', isi: 'x', mulai: new Date(now - 5 * JAM), selesai: new Date(now - 4 * JAM) },
    ]);

    const res = await request(app).get('/api/campaign/events');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.items.map((e) => [e.judul, e.status]),
      [
        ['CFD Jl. Pemuda', 'berlangsung'],
        ['Rekayasa arus', 'mendatang'],
        ['Konser', 'mendatang'],
      ],
    );
    assert.deepEqual(res.body.items[0].lokasi, { lat: 3.5844, lng: 98.6789 });
    assert.equal(res.body.items[1].lokasi, null);
  });

  test('event yang mulai lebih dari 30 hari lagi belum ditampilkan', async () => {
    const now = Date.now();
    await Event.create({ judul: 'Jauh', isi: 'x', mulai: new Date(now + 40 * 24 * JAM), selesai: new Date(now + 41 * 24 * JAM) });
    const res = await request(app).get('/api/campaign/events');
    assert.equal(res.body.items.length, 0);
  });
});

describe('POST /campaign/feedback', () => {
  test('tanpa login 401', async () => {
    const res = await request(app).post('/api/campaign/feedback').send({ rating: 5 });
    assert.equal(res.status, 401);
  });

  test('tersimpan dengan pemiliknya; respons tanpa identitas lain', async () => {
    const auth = await daftar('sari');
    const res = await request(app)
      .post('/api/campaign/feedback')
      .set('Authorization', auth)
      .send({ rating: 4, komentar: '  Rutenya membantu.  ', fitur: 'navigasi' });
    assert.equal(res.status, 201);
    assert.equal(res.body.feedback.rating, 4);
    assert.equal(res.body.feedback.komentar, 'Rutenya membantu.');
    assert.equal(res.body.feedback.fitur, 'navigasi');
    assert.ok(res.body.feedback.id);
    assert.equal(res.body.feedback.user, undefined);

    const doc = await Feedback.findById(res.body.feedback.id).populate('user');
    assert.equal(doc.user.username, 'sari');
  });

  test('validasi rating, komentar, fitur', async () => {
    const auth = await daftar('andi');
    const kirim = (body) => request(app).post('/api/campaign/feedback').set('Authorization', auth).send(body);

    for (const rating of [undefined, 0, 6, 3.5, '5']) {
      const res = await kirim({ rating });
      assert.equal(res.status, 400, `rating ${rating}`);
      assert.match(res.body.message, /Rating/);
    }
    const panjang = await kirim({ rating: 3, komentar: 'a'.repeat(1001) });
    assert.equal(panjang.status, 400);
    assert.match(panjang.body.message, /1000/);

    const fitur = await kirim({ rating: 3, fitur: 'ojek' });
    assert.equal(fitur.status, 400);
    assert.match(fitur.body.message, /Fitur/);

    const kosong = await kirim({ rating: 5, komentar: '   ' });
    assert.equal(kosong.status, 201);
    assert.equal(kosong.body.feedback.komentar, null);
    assert.equal(kosong.body.feedback.fitur, null);
  });

  test(`dibatasi ${BATAS_UMPAN_BALIK_PER_HARI}× per 24 jam per pengguna`, async () => {
    const auth = await daftar('rina');
    for (let i = 0; i < BATAS_UMPAN_BALIK_PER_HARI; i++) {
      const ok = await request(app).post('/api/campaign/feedback').set('Authorization', auth).send({ rating: 5 });
      assert.equal(ok.status, 201);
    }
    const lagi = await request(app).post('/api/campaign/feedback').set('Authorization', auth).send({ rating: 5 });
    assert.equal(lagi.status, 429);
    assert.equal(lagi.body.code, 'BATAS_UMPAN_BALIK');

    // Pengguna lain tidak ikut terbatas.
    const lain = await daftar('tono');
    const res = await request(app).post('/api/campaign/feedback').set('Authorization', lain).send({ rating: 4 });
    assert.equal(res.status, 201);
  });
});
