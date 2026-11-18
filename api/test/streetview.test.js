import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { fotoTerdekat } from '../src/services/mapillary.js';
import GeoCache from '../src/models/GeoCache.js';

process.env.NODE_ENV = 'test';
let mongod;
let panggilan;
let balasan;

const fetchPalsu = async (url, opts) => {
  panggilan.push({ url: new URL(url), headers: opts?.headers || {} });
  const b = await balasan(new URL(url));
  return { ok: b.status >= 200 && b.status < 300, status: b.status, json: async () => b.body };
};

const TOKEN = 'MLY|token-tes';
const app = (extra = {}) =>
  createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailer: { send: async () => {} },
    fetch: fetchPalsu,
    mapillaryToken: TOKEN,
    mapillaryUrl: 'https://mly.contoh/',
    ...extra,
  });

const foto = (id, lng, lat, extra = {}) => ({
  id,
  thumb_1024_url: `https://cdn.contoh/${id}.jpg`,
  captured_at: 1767225600000,
  computed_geometry: { type: 'Point', coordinates: [lng, lat] },
  creator: { username: 'warga_medan', id: '9' },
  ...extra,
});

const AT = '3.5913,98.6782';

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
  balasan = () => ({
    status: 200,
    body: { data: [foto('jauh', 98.6795, 3.5925), foto('dekat', 98.6783, 3.5914)] },
  });
});

describe('fotoTerdekat', () => {
  test('memilih foto terdekat dan membentuk respons', () => {
    const f = fotoTerdekat(
      { data: [foto('jauh', 98.6795, 3.5925), foto('dekat', 98.6783, 3.5914)] },
      { lat: 3.5913, lng: 98.6782 },
    );
    assert.equal(f.id, 'dekat');
    assert.equal(f.url, 'https://cdn.contoh/dekat.jpg');
    assert.deepEqual(f.lokasi, { lat: 3.5914, lng: 98.6783 });
    assert.ok(f.jarakM < 20);
    assert.equal(f.diambil, '2026-01-01T00:00:00.000Z');
    assert.equal(f.pengunggah, 'warga_medan');
    assert.equal(f.halaman, 'https://www.mapillary.com/app/?pKey=dekat');
  });

  test('tanpa geometri terhitung → pakai geometry asli; tanpa thumbnail diabaikan', () => {
    const f = fotoTerdekat(
      {
        data: [
          foto('tanpa-url', 98.6782, 3.5913, { thumb_1024_url: undefined }),
          { ...foto('mentah', 98.679, 3.592), computed_geometry: undefined, geometry: { coordinates: [98.679, 3.592] } },
        ],
      },
      { lat: 3.5913, lng: 98.6782 },
    );
    assert.equal(f.id, 'mentah');
  });

  test('data kosong / rusak → null', () => {
    assert.equal(fotoTerdekat({ data: [] }, { lat: 3.59, lng: 98.67 }), null);
    assert.equal(fotoTerdekat(null, { lat: 3.59, lng: 98.67 }), null);
  });
});

describe('GET /api/streetview', () => {
  test('memanggil Mapillary dengan bbox kecil + token di header (bukan di URL)', async () => {
    const res = await request(app()).get(`/api/streetview?at=${AT}`).expect(200);
    assert.equal(res.body.foto.id, 'dekat');
    assert.equal(panggilan.length, 1);
    const { url, headers } = panggilan[0];
    assert.equal(url.origin + url.pathname, 'https://mly.contoh/images');
    assert.equal(url.searchParams.get('bbox'), '98.676700,3.589800,98.679700,3.592800');
    assert.match(url.searchParams.get('fields'), /thumb_1024_url/);
    assert.equal(headers.Authorization, `OAuth ${TOKEN}`);
    assert.ok(!url.toString().includes('token'));
    assert.match(headers['User-Agent'], /SmartMoveMedan/);
  });

  test('tidak ada foto di sekitar titik → { foto: null }', async () => {
    balasan = () => ({ status: 200, body: { data: [] } });
    const res = await request(app()).get(`/api/streetview?at=${AT}`).expect(200);
    assert.deepEqual(res.body, { foto: null });
  });

  test('cache: titik sama setelah dibulatkan → Mapillary dipanggil sekali', async () => {
    const a = app();
    await request(a).get('/api/streetview?at=3.59131,98.67819').expect(200);
    await request(a).get('/api/streetview?at=3.59129,98.67821').expect(200);
    assert.equal(panggilan.length, 1);
  });

  test('di luar Mebidang → 422 DI_LUAR_WILAYAH; format salah → 400', async () => {
    const r1 = await request(app()).get('/api/streetview?at=-6.2,106.8').expect(422);
    assert.equal(r1.body.code, 'DI_LUAR_WILAYAH');
    await request(app()).get('/api/streetview?at=medan').expect(400);
    await request(app()).get('/api/streetview').expect(400);
    assert.equal(panggilan.length, 0);
  });

  test('token belum diisi → 503 FOTO_JALAN_NONAKTIF tanpa memanggil Mapillary', async () => {
    const res = await request(app({ mapillaryToken: '' })).get(`/api/streetview?at=${AT}`).expect(503);
    assert.equal(res.body.code, 'FOTO_JALAN_NONAKTIF');
    assert.equal(panggilan.length, 0);
  });

  test('Mapillary gagal → 502 FOTO_JALAN_GAGAL, tidak dicache', async () => {
    balasan = () => ({ status: 500, body: {} });
    const a = app();
    const res = await request(a).get(`/api/streetview?at=${AT}`).expect(502);
    assert.equal(res.body.code, 'FOTO_JALAN_GAGAL');
    assert.equal(await GeoCache.countDocuments(), 0);
    balasan = () => {
      throw new Error('jaringan putus');
    };
    await request(a).get(`/api/streetview?at=${AT}`).expect(502);
  });
});
