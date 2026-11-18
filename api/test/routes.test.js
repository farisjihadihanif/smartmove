import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { keRute, teksLangkah } from '../src/services/osrm.js';
import GeoCache from '../src/models/GeoCache.js';

process.env.NODE_ENV = 'test';
let mongod;
let panggilan; // URL yang dikirim ke "OSRM"
let balasan; // (url) => { status, body } | throw

const fetchPalsu = async (url, opts) => {
  panggilan.push({ url: new URL(url), headers: opts?.headers || {} });
  const b = await balasan(new URL(url));
  return { ok: b.status >= 200 && b.status < 300, status: b.status, json: async () => b.body };
};

const app = (extra = {}) =>
  createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailer: { send: async () => {} },
    fetch: fetchPalsu,
    osrmUrl: 'https://osrm.contoh/',
    ...extra,
  });

const langkah = (type, modifier, name, distance, extra = {}) => ({
  distance,
  name,
  maneuver: { type, modifier, location: [98.66, 3.57], ...extra },
});

const OSRM_OK = {
  code: 'Ok',
  routes: [
    {
      distance: 4900.4,
      duration: 719.6,
      geometry: { type: 'LineString', coordinates: [[98.6566, 3.5617], [98.66, 3.57], [98.6782, 3.5913]] },
      legs: [
        {
          steps: [
            langkah('depart', undefined, 'Jalan Dr. Mansyur', 120),
            langkah('turn', 'left', 'Jalan Dr. Mansyur', 350.2),
            langkah('roundabout', undefined, 'Jalan Balai Kota', 200, { exit: 2 }),
            langkah('arrive', 'right', '', 0),
          ],
        },
      ],
    },
  ],
};

const USU = '3.5617,98.6566';
const MERDEKA = '3.5913,98.6782';

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await GeoCache.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await GeoCache.deleteMany({});
  panggilan = [];
  balasan = () => ({ status: 200, body: OSRM_OK });
});

describe('langkah bahasa Indonesia', () => {
  test('manuver umum diterjemahkan', () => {
    const cases = [
      [langkah('depart', undefined, 'Jalan Gatot Subroto'), 'Mulai di Jalan Gatot Subroto'],
      [langkah('turn', 'left', 'Jalan Dr. Mansyur'), 'Belok kiri ke Jalan Dr. Mansyur'],
      [langkah('turn', 'sharp right', 'Jalan Sudirman'), 'Belok tajam ke kanan ke Jalan Sudirman'],
      [langkah('turn', 'straight', ''), 'Lurus'],
      [langkah('turn', 'uturn', 'Jalan Imam Bonjol'), 'Putar balik di Jalan Imam Bonjol'],
      [langkah('end of road', 'right', 'Jalan Pemuda'), 'Belok kanan ke Jalan Pemuda'],
      [langkah('new name', 'straight', 'Jalan Ahmad Yani'), 'Lurus terus di Jalan Ahmad Yani'],
      [langkah('roundabout', undefined, 'Jalan Balai Kota', 0, { exit: 3 }), 'Masuk bundaran, keluar di jalan ketiga ke Jalan Balai Kota'],
      [langkah('fork', 'slight left', 'Tol Belmera'), 'Ambil cabang kiri ke Tol Belmera'],
      [langkah('arrive', 'left', ''), 'Tiba di tujuan, di sebelah kiri'],
      [langkah('arrive', undefined, ''), 'Tiba di tujuan'],
    ];
    for (const [step, teks] of cases) assert.equal(teksLangkah(step), teks);
  });

  test('keRute membentuk respons API_SPECS §6.1; walking pakai kecepatan jalan kaki', () => {
    const r = keRute(OSRM_OK, 'driving');
    assert.equal(r.mode, 'driving');
    assert.equal(r.jarakM, 4900);
    assert.equal(r.durasiS, 720);
    assert.deepEqual(r.garis[0], [98.6566, 3.5617]);
    assert.deepEqual(r.langkah[1], { teks: 'Belok kiri ke Jalan Dr. Mansyur', jarakM: 350, lokasi: [98.66, 3.57] });
    assert.equal(keRute(OSRM_OK, 'walking').durasiS, Math.round(4900 / (5000 / 3600)));
    assert.equal(keRute({ code: 'NoRoute', routes: [] }, 'driving'), null);
  });
});

describe('GET /api/routes', () => {
  test('mengirim permintaan OSRM yang benar + User-Agent', async () => {
    const res = await request(app()).get('/api/routes').query({ from: USU, to: MERDEKA, mode: 'driving' });
    assert.equal(res.status, 200);
    assert.equal(res.body.jarakM, 4900);
    assert.equal(res.body.langkah.length, 4);
    assert.equal(res.body.langkah[3].teks, 'Tiba di tujuan, di sebelah kanan');

    const { url, headers } = panggilan[0];
    assert.equal(url.origin, 'https://osrm.contoh');
    assert.equal(url.pathname, '/route/v1/driving/98.6566,3.5617;98.6782,3.5913');
    assert.equal(url.searchParams.get('steps'), 'true');
    assert.equal(url.searchParams.get('geometries'), 'geojson');
    assert.equal(url.searchParams.get('overview'), 'full');
    assert.match(headers['User-Agent'], /^SmartMoveMedan\//);
  });

  test('moda: bawaan driving, motor → profil driving, jalan kaki → foot', async () => {
    const a = app();
    assert.equal((await request(a).get('/api/routes').query({ from: USU, to: MERDEKA })).body.mode, 'driving');
    const motor = await request(a).get('/api/routes').query({ from: USU, to: MERDEKA, mode: 'motorcycle' });
    assert.equal(motor.body.mode, 'motorcycle');
    assert.match(panggilan[1].url.pathname, /^\/route\/v1\/driving\//);
    await request(a).get('/api/routes').query({ from: USU, to: MERDEKA, mode: 'walking' }).expect(200);
    assert.match(panggilan[2].url.pathname, /^\/route\/v1\/foot\//);
  });

  test('cache: titik sama setelah dibulatkan 4 desimal + moda sama → OSRM dipanggil sekali', async () => {
    const a = app();
    await request(a).get('/api/routes').query({ from: '3.56171,98.65661', to: MERDEKA }).expect(200);
    const res = await request(a).get('/api/routes').query({ from: '3.56169,98.65659', to: MERDEKA }).expect(200);
    assert.equal(panggilan.length, 1);
    assert.equal(res.body.jarakM, 4900);
    assert.ok(await GeoCache.findOne({ kunci: 'routes:driving:3.5617,98.6566;3.5913,98.6782' }));

    // Moda lain = kunci cache lain.
    await request(a).get('/api/routes').query({ from: USU, to: MERDEKA, mode: 'walking' }).expect(200);
    assert.equal(panggilan.length, 2);
  });

  test('asal atau tujuan di luar Mebidang → 422 DI_LUAR_WILAYAH tanpa memanggil OSRM', async () => {
    const a = app();
    for (const q of [
      { from: '-6.2,106.8', to: MERDEKA },
      { from: USU, to: '2.96,99.06' },
    ]) {
      const res = await request(a).get('/api/routes').query(q);
      assert.equal(res.status, 422);
      assert.equal(res.body.code, 'DI_LUAR_WILAYAH');
    }
    assert.equal(panggilan.length, 0);
    assert.equal(await GeoCache.countDocuments(), 0);
  });

  test('validasi: from/to wajib berformat lat,lng; moda tidak dikenal → 400', async () => {
    const a = app();
    assert.equal((await request(a).get('/api/routes').query({ to: MERDEKA })).status, 400);
    assert.equal((await request(a).get('/api/routes').query({ from: USU, to: 'abc' })).status, 400);
    assert.equal((await request(a).get('/api/routes').query({ from: USU, to: MERDEKA, mode: 'pesawat' })).status, 400);
    assert.equal(panggilan.length, 0);
  });

  test('OSRM tidak menemukan rute → 404, tidak dicache', async () => {
    balasan = () => ({ status: 400, body: { code: 'NoRoute', message: 'Impossible route' } });
    const res = await request(app()).get('/api/routes').query({ from: USU, to: MERDEKA });
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'RUTE_TIDAK_ADA');
    assert.equal(await GeoCache.countDocuments(), 0);
  });

  test('OSRM gagal (HTTP 503 / jaringan) → 502 LAYANAN_PETA_GAGAL, tidak dicache', async () => {
    balasan = () => ({ status: 503, body: {} });
    let res = await request(app()).get('/api/routes').query({ from: USU, to: MERDEKA });
    assert.equal(res.status, 502);
    assert.equal(res.body.code, 'LAYANAN_PETA_GAGAL');

    balasan = () => {
      throw new Error('ECONNRESET');
    };
    res = await request(app()).get('/api/routes').query({ from: USU, to: MERDEKA });
    assert.equal(res.status, 502);
    assert.equal(await GeoCache.countDocuments(), 0);
  });

  test('kuota layanan peta dipakai bersama /places dan /routes', async () => {
    const a = app({ mapRateLimit: { windowMs: 60_000, limit: 2 } });
    await request(a).get('/api/routes').query({ from: USU, to: MERDEKA }).expect(200);
    await request(a).get('/api/routes').query({ from: USU, to: MERDEKA }).expect(200);
    assert.equal((await request(a).get('/api/places/search').query({ q: 'medan' })).status, 429);
  });
});
