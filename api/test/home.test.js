import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { salamUntukJam } from '../src/routes/home.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import PointLedger from '../src/models/PointLedger.js';
import Trip from '../src/models/Trip.js';

process.env.NODE_ENV = 'test';
let mongod;
let waktu; // "jam server" yang dikendalikan tes
const JAM = 60 * 60 * 1000;

const app = () =>
  createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailMode: 'console',
    mailer: { send: async () => {} },
    authRateLimit: { windowMs: 60_000, limit: 1000 },
    now: () => waktu,
  });

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), PointLedger.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Event.deleteMany({}), PointLedger.deleteMany({}), Trip.deleteMany({})]);
  waktu = new Date('2026-11-19T00:30:00Z'); // 07.30 WIB
});

async function masuk(extra = {}) {
  const res = await request(app())
    .post('/api/auth/register')
    .send({ username: 'budi', email: 'budi@contoh.id', password: 'rahasia123', namaLengkap: 'Budi', ...extra });
  assert.equal(res.status, 201);
  return { token: res.body.token, user: await User.findOne({ username: 'budi' }) };
}

describe('salamUntukJam', () => {
  test('batas pagi/siang/sore/malam', () => {
    assert.equal(salamUntukJam(3), 'Selamat malam');
    assert.equal(salamUntukJam(4), 'Selamat pagi');
    assert.equal(salamUntukJam(10), 'Selamat pagi');
    assert.equal(salamUntukJam(11), 'Selamat siang');
    assert.equal(salamUntukJam(15), 'Selamat sore');
    assert.equal(salamUntukJam(18), 'Selamat malam');
    assert.equal(salamUntukJam(0), 'Selamat malam');
  });
});

describe('GET /api/home', () => {
  test('tamu: sapaan WIB tanpa nama, poin null', async () => {
    const res = await request(app()).get('/api/home');
    assert.equal(res.status, 200);
    assert.deepEqual(
      { ...res.body.sapaan, waktuServer: undefined },
      { salam: 'Selamat pagi', teks: 'Hallo! Selamat pagi', jam: '07.30', zona: 'WIB', waktuServer: undefined },
    );
    assert.equal(res.body.poin, null);
    assert.deepEqual(res.body.events, []);
    assert.deepEqual(res.body.notifikasi, []);
  });

  test('jam server dihitung dalam WIB, bukan UTC', async () => {
    waktu = new Date('2026-11-19T12:05:00Z'); // 19.05 WIB
    const res = await request(app()).get('/api/home');
    assert.equal(res.body.sapaan.salam, 'Selamat malam');
    assert.equal(res.body.sapaan.jam, '19.05');
  });

  test('pengguna: nama di sapaan + ringkasan poin bulan ini (WIB)', async () => {
    const { token, user } = await masuk();
    await User.updateOne({ _id: user._id }, { poin: 70 });
    await PointLedger.create([
      { user: user._id, jumlah: 50, alasan: 'pembayaran', ref: 'ORD-1', createdAt: new Date('2026-11-10T00:00:00Z') },
      { user: user._id, jumlah: 30, alasan: 'perjalanan', ref: 'TRP-1', createdAt: new Date('2026-11-18T23:00:00Z') },
      { user: user._id, jumlah: -10, alasan: 'tukar_voucher', ref: 'RED-1', createdAt: new Date('2026-11-18T23:30:00Z') },
      // 31 Okt 18.00 UTC = 1 Nov 01.00 WIB → masuk bulan ini
      { user: user._id, jumlah: 5, alasan: 'admin', ref: 'ADM-1', createdAt: new Date('2026-10-31T18:00:00Z') },
      // 31 Okt 16.00 UTC = 31 Okt 23.00 WIB → bulan lalu
      { user: user._id, jumlah: 99, alasan: 'admin', ref: 'ADM-0', createdAt: new Date('2026-10-31T16:00:00Z') },
    ]);

    const res = await request(app()).get('/api/home').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.sapaan.teks, 'Hallo! Selamat pagi, Budi');
    assert.deepEqual(res.body.poin, { saldo: 70, bulanIni: 85 });

    // Notifikasi poin hanya 7 hari terakhir, terbaru dulu.
    const poin = res.body.notifikasi.filter((n) => n.jenis === 'poin');
    assert.deepEqual(
      poin.map((n) => n.judul),
      ['-10 poin', '+30 poin'],
    );
    assert.equal(poin[1].isi, 'Poin dari perjalanan');
  });

  test('pengguna tanpa namaLengkap memakai username', async () => {
    const { token } = await masuk({ namaLengkap: undefined });
    const res = await request(app()).get('/api/home').set('Authorization', `Bearer ${token}`);
    assert.equal(res.body.sapaan.teks, 'Hallo! Selamat pagi, budi');
  });

  test('event aktif di events; event 24 jam ke depan jadi notifikasi', async () => {
    await Event.create([
      { judul: 'CFD Jl. Pemuda', isi: 'Car free day', jenis: 'cfd', mulai: new Date(waktu - JAM), selesai: new Date(+waktu + JAM) },
      { judul: 'Rekayasa arus Gatsu', isi: 'Pengalihan', jenis: 'rekayasa_arus', mulai: new Date(+waktu + 3 * JAM), selesai: new Date(+waktu + 5 * JAM) },
      { judul: 'Sudah lewat', isi: 'x', mulai: new Date(waktu - 5 * JAM), selesai: new Date(waktu - 2 * JAM) },
      { judul: 'Masih jauh', isi: 'x', mulai: new Date(+waktu + 48 * JAM), selesai: new Date(+waktu + 50 * JAM) },
    ]);

    const res = await request(app()).get('/api/home');
    assert.deepEqual(res.body.events.map((e) => e.judul), ['CFD Jl. Pemuda']);
    assert.equal(res.body.events[0].jenis, 'cfd');
    assert.equal(res.body.notifikasi.length, 1);
    assert.equal(res.body.notifikasi[0].jenis, 'event');
    assert.equal(res.body.notifikasi[0].judul, 'Rekayasa arus Gatsu');
    assert.equal(res.body.notifikasi[0].isi, 'Dimulai 10.30 WIB');
  });

  test('rencana perjalanan 24 jam ke depan jadi pengingat, hanya milik sendiri', async () => {
    const { token, user } = await masuk();
    const lain = await User.create({ username: 'ani', email: 'ani@contoh.id', password: 'x'.repeat(60) });
    const tempat = (nama) => ({ nama, lokasi: { type: 'Point', coordinates: [98.67, 3.59] } });
    await Trip.create([
      { user: user._id, asal: tempat('Rumah'), tujuan: tempat('Kualanamu'), moda: 'transit', berangkatPada: new Date(+waktu + 2 * JAM) },
      { user: user._id, judul: 'Kantor', asal: tempat('Rumah'), tujuan: tempat('Kantor'), moda: 'driving', berangkatPada: new Date(+waktu + 30 * JAM) },
      { user: lain._id, asal: tempat('A'), tujuan: tempat('B'), moda: 'walking', berangkatPada: new Date(+waktu + JAM) },
    ]);

    const res = await request(app()).get('/api/home').set('Authorization', `Bearer ${token}`);
    const trip = res.body.notifikasi.filter((n) => n.jenis === 'trip');
    assert.equal(trip.length, 1);
    assert.equal(trip[0].judul, 'Ke Kualanamu');
    assert.equal(trip[0].isi, 'Berangkat 09.30 WIB');
  });

  test('token tidak sah diperlakukan sebagai tamu', async () => {
    const res = await request(app()).get('/api/home').set('Authorization', 'Bearer ngawur');
    assert.equal(res.status, 200);
    assert.equal(res.body.poin, null);
  });
});
