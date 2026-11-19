import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import Trip from '../src/models/Trip.js';

process.env.NODE_ENV = 'test';
let mongod;
let app;

const ASAL = { nama: 'Lapangan Merdeka', lokasi: { lat: 3.5906, lng: 98.6779 } };
const TUJUAN = { nama: 'Bandara Kualanamu', lokasi: { lat: 3.6422, lng: 98.8853 } };
const BARU = { judul: 'Ke bandara', asal: ASAL, tujuan: TUJUAN, moda: 'driving' };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.init();
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
  await Promise.all([User.deleteMany({}), Trip.deleteMany({})]);
});

async function daftar(username) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@contoh.id`, password: 'rahasia123' });
  assert.equal(res.status, 201);
  return `Bearer ${res.body.token}`;
}

const buat = (auth, body = BARU) => request(app).post('/api/trips').set('Authorization', auth).send(body);

describe('/trips', () => {
  test('tanpa login ditolak 401', async () => {
    const res = await request(app).get('/api/trips');
    assert.equal(res.status, 401);
    assert.equal((await request(app).post('/api/trips').send(BARU)).status, 401);
  });

  test('simpan lalu ambil detail dengan koordinat {lat, lng}', async () => {
    const auth = await daftar('budi');
    const res = await buat(auth, {
      ...BARU,
      berangkatPada: '2026-12-01T07:30:00+07:00',
      ringkasan: { jarakM: 32100, durasiS: 2400, tarif: 0 },
    });
    assert.equal(res.status, 201);
    const t = res.body.trip;
    assert.equal(t.judul, 'Ke bandara');
    assert.deepEqual(t.asal, ASAL);
    assert.deepEqual(t.tujuan, TUJUAN);
    assert.equal(t.moda, 'driving');
    assert.equal(t.berangkatPada, '2026-12-01T00:30:00.000Z');
    assert.deepEqual(t.ringkasan, { jarakM: 32100, durasiS: 2400, tarif: 0 });
    assert.equal(t.user, undefined);

    const db = await Trip.findById(t.id);
    assert.deepEqual([...db.asal.lokasi.coordinates], [98.6779, 3.5906]);

    const det = await request(app).get(`/api/trips/${t.id}`).set('Authorization', auth);
    assert.equal(det.status, 200);
    assert.deepEqual(det.body.trip, t);
  });

  test('field opsional kosong jadi null', async () => {
    const auth = await daftar('budi');
    const res = await buat(auth, { asal: ASAL, tujuan: TUJUAN, moda: 'walking' });
    assert.equal(res.status, 201);
    assert.equal(res.body.trip.judul, null);
    assert.equal(res.body.trip.berangkatPada, null);
    assert.equal(res.body.trip.ringkasan, null);
  });

  test('validasi input', async () => {
    const auth = await daftar('budi');
    const kasus = [
      [{ ...BARU, asal: undefined }, 400],
      [{ ...BARU, asal: { nama: '', lokasi: ASAL.lokasi } }, 400],
      [{ ...BARU, tujuan: { nama: 'X', lokasi: { lat: '3.5', lng: 98.6 } } }, 400],
      [{ ...BARU, moda: 'pesawat' }, 400],
      [{ ...BARU, judul: 'a'.repeat(101) }, 400],
      [{ ...BARU, berangkatPada: 'besok' }, 400],
      [{ ...BARU, ringkasan: { jarakM: -1 } }, 400],
      [{ ...BARU, ringkasan: { tarif: 5000, tarifPerkiraan: 'ya' } }, 400],
    ];
    for (const [body, status] of kasus) {
      const res = await buat(auth, body);
      assert.equal(res.status, status, JSON.stringify(body));
      assert.ok(res.body.message);
    }
    const luar = await buat(auth, { ...BARU, tujuan: { nama: 'Jakarta', lokasi: { lat: -6.2, lng: 106.8 } } });
    assert.equal(luar.status, 422);
    assert.equal(luar.body.code, 'DI_LUAR_WILAYAH');
    assert.equal(await Trip.countDocuments(), 0);
  });

  test('daftar hanya milik sendiri, terbaru dulu, berpaginasi', async () => {
    const budi = await daftar('budi');
    const ani = await daftar('ani');
    for (let i = 1; i <= 3; i++) await buat(budi, { ...BARU, judul: `Trip ${i}` });
    await buat(ani, { ...BARU, judul: 'Punya Ani' });

    const res = await request(app).get('/api/trips?page=1&limit=2').set('Authorization', budi);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.page, 1);
    assert.deepEqual(
      res.body.items.map((t) => t.judul),
      ['Trip 3', 'Trip 2'],
    );
    const hal2 = await request(app).get('/api/trips?page=2&limit=2').set('Authorization', budi);
    assert.deepEqual(
      hal2.body.items.map((t) => t.judul),
      ['Trip 1'],
    );
    assert.equal((await request(app).get('/api/trips?page=0').set('Authorization', budi)).status, 400);
  });

  test('ubah sebagian dan kosongkan field opsional', async () => {
    const auth = await daftar('budi');
    const { trip } = (await buat(auth, { ...BARU, berangkatPada: '2026-12-01T07:30:00+07:00' })).body;

    const res = await request(app)
      .patch(`/api/trips/${trip.id}`)
      .set('Authorization', auth)
      .send({ moda: 'transit', judul: '  Pulang  ', berangkatPada: null, ringkasan: { tarif: 4000, tarifPerkiraan: true } });
    assert.equal(res.status, 200);
    assert.equal(res.body.trip.moda, 'transit');
    assert.equal(res.body.trip.judul, 'Pulang');
    assert.equal(res.body.trip.berangkatPada, null);
    assert.deepEqual(res.body.trip.ringkasan, { tarif: 4000, tarifPerkiraan: true });
    assert.deepEqual(res.body.trip.asal, ASAL);

    const salah = await request(app).patch(`/api/trips/${trip.id}`).set('Authorization', auth).send({ moda: 'x' });
    assert.equal(salah.status, 400);
  });

  test('trip orang lain tidak bisa dilihat, diubah, atau dihapus', async () => {
    const budi = await daftar('budi');
    const ani = await daftar('ani');
    const { trip } = (await buat(budi)).body;

    assert.equal((await request(app).get(`/api/trips/${trip.id}`).set('Authorization', ani)).status, 404);
    assert.equal(
      (await request(app).patch(`/api/trips/${trip.id}`).set('Authorization', ani).send({ judul: 'x' })).status,
      404,
    );
    assert.equal((await request(app).delete(`/api/trips/${trip.id}`).set('Authorization', ani)).status, 404);
    assert.equal((await Trip.findById(trip.id)).judul, 'Ke bandara');
    assert.equal((await request(app).get('/api/trips/bukan-id').set('Authorization', budi)).status, 404);
  });

  test('hapus milik sendiri', async () => {
    const auth = await daftar('budi');
    const { trip } = (await buat(auth)).body;
    const res = await request(app).delete(`/api/trips/${trip.id}`).set('Authorization', auth);
    assert.equal(res.status, 204);
    assert.equal(await Trip.countDocuments(), 0);
    assert.equal((await request(app).delete(`/api/trips/${trip.id}`).set('Authorization', auth)).status, 404);
  });
});
