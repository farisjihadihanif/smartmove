import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { createNominatim, keTempat } from '../src/services/nominatim.js';
import { dalamWilayah, parseLatLng } from '../src/lib/wilayah.js';
import GeoCache from '../src/models/GeoCache.js';

process.env.NODE_ENV = 'test';
let mongod;
let panggilan; // URL yang dikirim ke "Nominatim"
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
    nominatimIntervalMs: 0,
    nominatimEmail: 'kontak@contoh.id',
    ...extra,
  });

const LAPANGAN_MERDEKA = {
  place_id: 1,
  osm_type: 'way',
  osm_id: 111,
  lat: '3.5906',
  lon: '98.6777',
  name: 'Lapangan Merdeka',
  display_name: 'Lapangan Merdeka, Jalan Balai Kota, Kesawan, Medan Barat, Medan, Sumatera Utara, Indonesia',
  category: 'leisure',
  type: 'park',
};
const KUALANAMU = {
  place_id: 2,
  osm_type: 'way',
  osm_id: 222,
  lat: '3.6422',
  lon: '98.8853',
  name: 'Bandara Internasional Kualanamu',
  display_name: 'Bandara Internasional Kualanamu, Beringin, Deli Serdang, Sumatera Utara, Indonesia',
  category: 'aeroway',
  type: 'aerodrome',
};
const LUAR = { ...LAPANGAN_MERDEKA, place_id: 3, osm_id: 333, lat: '-6.2', lon: '106.8', name: 'Monas' };

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
  balasan = (url) =>
    url.pathname === '/search'
      ? { status: 200, body: [KUALANAMU, LAPANGAN_MERDEKA, LUAR] }
      : { status: 200, body: LAPANGAN_MERDEKA };
});

describe('wilayah', () => {
  test('parseLatLng menerima lat,lng dan menolak format salah', () => {
    assert.deepEqual(parseLatLng('3.5906,98.6777'), { lat: 3.5906, lng: 98.6777 });
    assert.deepEqual(parseLatLng(' 3.5 , 98.6 '), { lat: 3.5, lng: 98.6 });
    for (const v of ['', 'abc', '3.5', '91,98', '3.5,181', undefined, ['3,98']]) {
      assert.throws(() => parseLatLng(v), (e) => e.status === 400, String(v));
    }
  });

  test('Medan, Binjai, Kualanamu di dalam; Jakarta & Pematangsiantar di luar', () => {
    assert.ok(dalamWilayah({ lat: 3.5906, lng: 98.6777 }));
    assert.ok(dalamWilayah({ lat: 3.6, lng: 98.485 }));
    assert.ok(dalamWilayah({ lat: 3.6422, lng: 98.8853 }));
    assert.ok(!dalamWilayah({ lat: -6.2, lng: 106.8 }));
    assert.ok(!dalamWilayah({ lat: 2.96, lng: 99.06 }));
  });

  test('keTempat memisahkan nama dan alamat', () => {
    const t = keTempat(LAPANGAN_MERDEKA);
    assert.equal(t.id, 'osm:way111');
    assert.equal(t.nama, 'Lapangan Merdeka');
    assert.equal(t.alamat, 'Jalan Balai Kota, Kesawan, Medan Barat, Medan, Sumatera Utara, Indonesia');
    assert.equal(t.jenis, 'park');
    assert.deepEqual(t.lokasi, { lat: 3.5906, lng: 98.6777 });
  });
});

describe('GET /api/places/search', () => {
  test('mengirim parameter Nominatim yang benar + User-Agent, hasil di luar wilayah dibuang', async () => {
    const res = await request(app()).get('/api/places/search').query({ q: '  lapangan   merdeka ' });
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.items.map((i) => i.nama),
      ['Bandara Internasional Kualanamu', 'Lapangan Merdeka'],
    );
    assert.equal(panggilan.length, 1);
    const { url, headers } = panggilan[0];
    assert.equal(url.origin, 'https://nominatim.openstreetmap.org');
    assert.equal(url.searchParams.get('q'), 'lapangan merdeka');
    assert.equal(url.searchParams.get('format'), 'jsonv2');
    assert.equal(url.searchParams.get('bounded'), '1');
    assert.equal(url.searchParams.get('countrycodes'), 'id');
    assert.equal(url.searchParams.get('viewbox'), '98.35,3.9,99,3.25');
    assert.equal(url.searchParams.get('email'), 'kontak@contoh.id');
    assert.match(headers['User-Agent'], /^SmartMoveMedan\//);
  });

  test('near di Medan → urut terdekat + jarakM', async () => {
    const res = await request(app()).get('/api/places/search').query({ q: 'medan', near: '3.5850,98.6720' });
    assert.equal(res.status, 200);
    assert.equal(res.body.items[0].nama, 'Lapangan Merdeka');
    assert.ok(res.body.items[0].jarakM < res.body.items[1].jarakM);
  });

  test('near di luar wilayah diabaikan (tanpa jarakM, tetap 200)', async () => {
    const res = await request(app()).get('/api/places/search').query({ q: 'medan', near: '-6.2,106.8' });
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 2);
    assert.equal(res.body.items[0].jarakM, undefined);
  });

  test('cache: pencarian sama (beda huruf besar/spasi) tidak memanggil Nominatim lagi', async () => {
    const a = app();
    await request(a).get('/api/places/search').query({ q: 'Lapangan Merdeka' }).expect(200);
    const res = await request(a).get('/api/places/search').query({ q: 'lapangan  merdeka' }).expect(200);
    assert.equal(panggilan.length, 1);
    assert.equal(res.body.items.length, 2);
    assert.ok(await GeoCache.findOne({ kunci: 'places:search:lapangan merdeka' }));
  });

  test('validasi q dan near', async () => {
    const a = app();
    assert.equal((await request(a).get('/api/places/search')).status, 400);
    assert.equal((await request(a).get('/api/places/search').query({ q: 'a' })).status, 400);
    assert.equal((await request(a).get('/api/places/search').query({ q: 'x'.repeat(101) })).status, 400);
    assert.equal((await request(a).get('/api/places/search').query({ q: 'medan', near: 'abc' })).status, 400);
    assert.equal(panggilan.length, 0);
  });

  test('Nominatim gagal (HTTP 503 / jaringan) → 502 LAYANAN_PETA_GAGAL, tidak dicache', async () => {
    balasan = () => ({ status: 503, body: {} });
    let res = await request(app()).get('/api/places/search').query({ q: 'medan' });
    assert.equal(res.status, 502);
    assert.equal(res.body.code, 'LAYANAN_PETA_GAGAL');

    balasan = () => {
      throw new Error('ECONNRESET');
    };
    res = await request(app()).get('/api/places/search').query({ q: 'medan' });
    assert.equal(res.status, 502);
    assert.equal(await GeoCache.countDocuments(), 0);
  });
});

describe('GET /api/places/reverse', () => {
  test('titik di Medan → nama tempat; cache per 4 desimal', async () => {
    const a = app();
    const res = await request(a).get('/api/places/reverse').query({ at: '3.59061,98.67771' });
    assert.equal(res.status, 200);
    assert.equal(res.body.tempat.nama, 'Lapangan Merdeka');
    const { url } = panggilan[0];
    assert.equal(url.pathname, '/reverse');
    assert.equal(url.searchParams.get('lat'), '3.59061');
    assert.equal(url.searchParams.get('lon'), '98.67771');

    await request(a).get('/api/places/reverse').query({ at: '3.59059,98.67769' }).expect(200);
    assert.equal(panggilan.length, 1);
  });

  test('di luar Mebidang → 422 DI_LUAR_WILAYAH tanpa memanggil Nominatim', async () => {
    const res = await request(app()).get('/api/places/reverse').query({ at: '-6.2,106.8' });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'DI_LUAR_WILAYAH');
    assert.equal(panggilan.length, 0);
  });

  test('format salah → 400; Nominatim tidak menemukan → 404', async () => {
    assert.equal((await request(app()).get('/api/places/reverse')).status, 400);
    balasan = () => ({ status: 200, body: { error: 'Unable to geocode' } });
    assert.equal((await request(app()).get('/api/places/reverse').query({ at: '3.5,98.6' })).status, 404);
  });
});

describe('batas permintaan & antrian Nominatim', () => {
  test('lebih dari batas/menit → 429', async () => {
    const a = app({ mapRateLimit: { windowMs: 60_000, limit: 2 } });
    await request(a).get('/api/places/search').query({ q: 'medan' }).expect(200);
    await request(a).get('/api/places/search').query({ q: 'medan' }).expect(200);
    const res = await request(a).get('/api/places/search').query({ q: 'medan' });
    assert.equal(res.status, 429);
  });

  test('permintaan ke Nominatim diberi jeda minimal', async () => {
    const waktu = [];
    const n = createNominatim(
      { nominatimIntervalMs: 80, mapUserAgent: 'tes' },
      {
        fetch: async () => {
          waktu.push(Date.now());
          return { ok: true, json: async () => [] };
        },
      },
    );
    await Promise.all([n.search('a'), n.search('b'), n.reverse({ lat: 3.5, lng: 98.6 })]);
    assert.equal(waktu.length, 3);
    assert.ok(waktu[1] - waktu[0] >= 75, `jeda ${waktu[1] - waktu[0]}`);
    assert.ok(waktu[2] - waktu[1] >= 75, `jeda ${waktu[2] - waktu[1]}`);
  });
});
