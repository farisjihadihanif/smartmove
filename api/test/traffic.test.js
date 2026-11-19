import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import TrafficReport from '../src/models/TrafficReport.js';
import GeoCache from '../src/models/GeoCache.js';
import RoadCorridor from '../src/models/RoadCorridor.js';
import {
  createTrafficProvider,
  estimasiDariLaporan,
  proyeksiKeGaris,
  titikSampel,
} from '../src/services/trafficProvider.js';
import { BATAS_PER_JAM } from '../src/services/trafficReports.js';

process.env.NODE_ENV = 'test';
let mongod;
let app;
let panggilanOsrm;
let osrmGagal;

// OSRM palsu: lewat semua titik, jarak = 1,1 × garis lurus (titik "menempel"), 10 m/dtk.
const fetchPalsu = async (url) => {
  const u = new URL(url);
  panggilanOsrm.push(u);
  if (osrmGagal) throw new Error('jaringan putus');
  const t = decodeURIComponent(u.pathname.split('/').pop())
    .split(';')
    .map((x) => x.split(',').map(Number));
  let jarak = 0;
  for (let i = 1; i < t.length; i++) jarak += Math.hypot((t[i][0] - t[i - 1][0]) * 111320, (t[i][1] - t[i - 1][1]) * 110574);
  const body = { code: 'Ok', routes: [{ distance: jarak * 1.1, duration: jarak / 10, legs: [] }] };
  return { ok: true, status: 200, json: async () => body };
};

const MERDEKA = { lat: 3.5913, lng: 98.6782 };
const geser = (p, meterUtara) => ({ lat: p.lat + meterUtara / 110574, lng: p.lng });

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), TrafficReport.init(), GeoCache.init(), RoadCorridor.init()]);
  app = createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailer: { send: async () => {} },
    authRateLimit: { windowMs: 60_000, limit: 1000 },
    fetch: fetchPalsu,
    osrmUrlCar: 'https://osrm.contoh/mobil',
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    TrafficReport.deleteMany({}),
    GeoCache.deleteMany({}),
    RoadCorridor.deleteMany({}),
  ]);
  panggilanOsrm = [];
  osrmGagal = false;
});

async function daftar(username) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@contoh.id`, password: 'rahasia123' });
  assert.equal(res.status, 201);
  return `Bearer ${res.body.token}`;
}

const lapor = (auth, body) => request(app).post('/api/traffic/reports').set('Authorization', auth).send(body);
const macetDi = (lokasi, extra = {}) => ({ lokasi, tingkat: 'macet', ...extra });

describe('POST /traffic/reports', () => {
  test('wajib login', async () => {
    const res = await request(app).post('/api/traffic/reports').send(macetDi(MERDEKA));
    assert.equal(res.status, 401);
  });

  test('validasi input', async () => {
    const auth = await daftar('budi');
    assert.equal((await lapor(auth, { lokasi: MERDEKA, tingkat: 'parah' })).status, 400);
    assert.equal((await lapor(auth, macetDi(MERDEKA, { kejadian: 'gempa' }))).status, 400);
    assert.equal((await lapor(auth, macetDi({ lat: '3.5', lng: 98.6 }))).status, 400);
    assert.equal((await lapor(auth, macetDi(MERDEKA, { catatan: 'x'.repeat(201) }))).status, 400);
    const luar = await lapor(auth, macetDi({ lat: -6.2, lng: 106.8 }));
    assert.equal(luar.status, 422);
    assert.equal(luar.body.code, 'DI_LUAR_WILAYAH');
    assert.equal(await TrafficReport.countDocuments(), 0);
  });

  test('laporan baru 201, kedaluwarsa 2 jam, tanpa identitas pelapor', async () => {
    const auth = await daftar('budi');
    const res = await lapor(auth, macetDi(MERDEKA, { kejadian: 'banjir', catatan: '  Air selutut  ' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.digabung, false);
    const l = res.body.laporan;
    assert.deepEqual(l.lokasi, MERDEKA);
    assert.equal(l.tingkat, 'macet');
    assert.equal(l.kejadian, 'banjir');
    assert.equal(l.catatan, 'Air selutut');
    assert.equal(l.konfirmasi, 0);
    assert.equal(l.user, undefined);
    assert.equal(l.konfirmasiOleh, undefined);
    const sisa = new Date(l.expiresAt) - Date.now();
    assert.ok(Math.abs(sisa - 2 * 3600_000) < 10_000);
  });

  test('laporan sejenis ≤ 300 m digabung jadi konfirmasi + umur diperpanjang', async () => {
    const budi = await daftar('budi');
    const sari = await daftar('sari');
    const a = await lapor(budi, macetDi(MERDEKA));
    await TrafficReport.collection.updateOne({}, { $set: { expiresAt: new Date(Date.now() + 60_000) } });

    const b = await lapor(sari, macetDi(geser(MERDEKA, 250)));
    assert.equal(b.status, 200);
    assert.equal(b.body.digabung, true);
    assert.equal(b.body.laporan.id, a.body.laporan.id);
    assert.equal(b.body.laporan.konfirmasi, 1);
    assert.ok(new Date(b.body.laporan.expiresAt) - Date.now() > 3600_000);
    assert.equal(await TrafficReport.countDocuments(), 1);
  });

  test('orang yang sama tidak bisa menambah konfirmasi berkali-kali', async () => {
    const budi = await daftar('budi');
    const sari = await daftar('sari');
    await lapor(budi, macetDi(MERDEKA));
    await lapor(budi, macetDi(geser(MERDEKA, 50))); // pelapor sendiri
    await lapor(sari, macetDi(geser(MERDEKA, 20)));
    const ulang = await lapor(sari, macetDi(geser(MERDEKA, 30)));
    assert.equal(ulang.body.digabung, true);
    assert.equal(ulang.body.laporan.konfirmasi, 1);
    const [doc] = await TrafficReport.find().select('+konfirmasiOleh');
    assert.equal(doc.konfirmasi, 1);
    assert.equal(doc.konfirmasiOleh.length, 1);
  });

  test('tidak digabung: jenis beda, terlalu jauh, atau sudah > 30 menit', async () => {
    const budi = await daftar('budi');
    const sari = await daftar('sari');
    await lapor(budi, macetDi(MERDEKA));
    assert.equal((await lapor(sari, { lokasi: MERDEKA, tingkat: 'padat' })).status, 201);
    assert.equal((await lapor(sari, macetDi(MERDEKA, { kejadian: 'kecelakaan' }))).status, 201);
    assert.equal((await lapor(sari, macetDi(geser(MERDEKA, 400)))).status, 201);

    const lama = new Date(Date.now() - 31 * 60_000);
    await TrafficReport.collection.updateMany({}, { $set: { updatedAt: lama } });
    assert.equal((await lapor(sari, macetDi(geser(MERDEKA, 10)))).status, 201);
    assert.equal(await TrafficReport.countDocuments(), 5);
  });

  test('laporan kedaluwarsa tidak digabung', async () => {
    const budi = await daftar('budi');
    const sari = await daftar('sari');
    await lapor(budi, macetDi(MERDEKA));
    await TrafficReport.collection.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await lapor(sari, macetDi(MERDEKA))).status, 201);
  });

  test(`batas ${BATAS_PER_JAM} laporan/jam/pengguna (konfirmasi ikut dihitung)`, async () => {
    const budi = await daftar('budi');
    const sari = await daftar('sari');
    await lapor(sari, macetDi(MERDEKA));
    assert.equal((await lapor(budi, macetDi(MERDEKA))).status, 200); // konfirmasi = 1 aksi
    for (let i = 1; i < BATAS_PER_JAM; i++) {
      assert.equal((await lapor(budi, macetDi(geser(MERDEKA, i * 1000)))).status, 201);
    }
    const lebih = await lapor(budi, macetDi(geser(MERDEKA, 9000)));
    assert.equal(lebih.status, 429);
    assert.equal(lebih.body.code, 'BATAS_LAPORAN');
    // Pengguna lain tidak terdampak.
    assert.equal((await lapor(sari, macetDi(geser(MERDEKA, 9000)))).status, 201);

    // Lewat satu jam, kuota pulih.
    const lama = new Date(Date.now() - 61 * 60_000);
    await TrafficReport.collection.updateMany({}, { $set: { createdAt: lama, 'konfirmasiOleh.$[].pada': lama } });
    assert.equal((await lapor(budi, macetDi(geser(MERDEKA, 12000)))).status, 201);
  });
});

describe('GET /traffic', () => {
  const BBOX = '98.60,3.55,98.72,3.62';

  test('bbox wajib dan dibatasi', async () => {
    assert.equal((await request(app).get('/api/traffic')).status, 400);
    assert.equal((await request(app).get('/api/traffic?bbox=1,2,3')).status, 400);
    assert.equal((await request(app).get('/api/traffic?bbox=98.7,3.5,98.6,3.6')).status, 400);
    assert.equal((await request(app).get('/api/traffic?bbox=97,2,99,4')).status, 400);
  });

  test('hanya laporan aktif di dalam area, tanpa identitas', async () => {
    const budi = await daftar('budi');
    await lapor(budi, macetDi(MERDEKA, { catatan: 'Ada demo' }));
    await lapor(budi, macetDi({ lat: 3.65, lng: 98.88 })); // Kualanamu, di luar kotak
    await lapor(budi, { lokasi: geser(MERDEKA, 2000), tingkat: 'padat' });
    await TrafficReport.collection.updateOne(
      { tingkat: 'padat' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const res = await request(app).get(`/api/traffic?bbox=${BBOX}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.sumber, 'komunitas');
    assert.equal(res.body.items.length, 1);
    const [l] = res.body.items;
    assert.equal(l.catatan, 'Ada demo');
    assert.equal(l.sumber, 'komunitas');
    assert.equal(l.user, undefined);
  });
});

describe('estimasi koridor', () => {
  // Garis lurus 1 km ke utara dari Merdeka, normal 100 dtk.
  const garis = [
    [MERDEKA.lng, MERDEKA.lat],
    [MERDEKA.lng, MERDEKA.lat + 1000 / 110574],
  ];
  const rute = { jarakM: 1000, durasiS: 100, garis };
  const laporan = (meter, tingkat, kejadian = 'none', geserTimurM = 0) => ({
    lokasi: { coordinates: [MERDEKA.lng + geserTimurM / 111000, MERDEKA.lat + meter / 110574] },
    tingkat,
    kejadian,
  });

  test('proyeksi titik ke garis', () => {
    const p = proyeksiKeGaris(garis, [MERDEKA.lng + 50 / 111000, MERDEKA.lat + 400 / 110574]);
    assert.ok(Math.abs(p.jarakM - 50) < 2);
    assert.ok(Math.abs(p.sepanjangM - 400) < 2);
  });

  test('tanpa laporan: waktu normal, tingkat belum diketahui', () => {
    const e = estimasiDariLaporan(rute, []);
    assert.equal(e.durasiS, 100);
    assert.equal(e.tingkat, null);
    assert.equal(e.laporan, 0);
    assert.deepEqual(e.segmen, []);
  });

  test('laporan macet di tengah memperlambat ±500 m ruas', () => {
    const e = estimasiDariLaporan(rute, [laporan(500, 'macet')]);
    // 50% garis ×3, 50% ×1 → 200 dtk.
    assert.ok(e.durasiS >= 190 && e.durasiS <= 215, `durasi ${e.durasiS}`);
    assert.equal(e.tingkat, 'macet');
    assert.equal(e.segmen.length, 1);
    assert.equal(e.segmen[0].tingkat, 'macet');
    assert.ok(e.segmen[0].garis.length >= 2);
  });

  test('laporan jauh dari garis diabaikan; penutupan ditandai', () => {
    assert.equal(estimasiDariLaporan(rute, [laporan(500, 'macet', 'none', 200)]).laporan, 0);
    const e = estimasiDariLaporan(rute, [laporan(100, 'lancar', 'penutupan')]);
    assert.equal(e.ditutup, true);
    assert.deepEqual(e.kejadian, ['penutupan']);
    assert.ok(e.durasiS > 100);
  });

  test('penyedia tidak dikenal ditolak saat start', () => {
    assert.throws(() => createTrafficProvider({ trafficProvider: 'tomtom' }, {}), /TRAFFIC_PROVIDER/);
  });
});

describe('GET /traffic/corridors', () => {
  // Dua koridor lurus ke utara: 3 km dan 1 km.
  const lurus = (lat, lng, meterPanjang) => [
    [lng, lat],
    [lng, lat + meterPanjang / 2 / 110574],
    [lng, lat + meterPanjang / 110574],
  ];
  const seedKoridor = () =>
    RoadCorridor.create([
      { kode: 'GATSU', nama: 'Jl. Gatot Subroto', urutan: 0, panjangM: 3000, jalur: { type: 'LineString', coordinates: lurus(3.59, 98.62, 3000) } },
      { kode: 'KATAMSO', nama: 'Jl. Brigjend Katamso', urutan: 1, panjangM: 1000, jalur: { type: 'LineString', coordinates: lurus(3.56, 98.683, 1000) } },
      { kode: 'LAMA', nama: 'Disembunyikan', urutan: 2, panjangM: 1000, aktif: false, jalur: { type: 'LineString', coordinates: lurus(3.56, 98.7, 1000) } },
    ]);

  test('titik sampel tiap ±1,5 km dengan arah jalan', () => {
    const t = titikSampel(lurus(3.59, 98.62, 3000));
    assert.equal(t.length, 3);
    assert.ok(t.every((x) => x.arah < 1 || x.arah > 359), 'arah ke utara ≈ 0°');
    assert.ok(Math.abs(t[1].lat - (3.59 + 1500 / 110574)) < 1e-6);
  });

  test('belum diimpor → daftar kosong', async () => {
    const res = await request(app).get('/api/traffic/corridors');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
  });

  test('geometri dari DB, waktu normal dari OSRM (lewat titik + bearings), dicache', async () => {
    await seedKoridor();
    const budi = await daftar('budi');
    await lapor(budi, macetDi({ lat: 3.59 + 1500 / 110574, lng: 98.62 }));

    const res = await request(app).get('/api/traffic/corridors');
    assert.equal(res.status, 200);
    assert.equal(res.body.sumber, 'komunitas');
    assert.deepEqual(res.body.items.map((k) => k.kode), ['GATSU', 'KATAMSO']);
    assert.equal(panggilanOsrm.length, 2);
    const u = panggilanOsrm[0];
    assert.ok(u.pathname.includes('/route/v1/driving/'));
    assert.equal(u.pathname.split('/').pop().split(';').length, 3);
    assert.equal(u.searchParams.get('bearings').split(';').length, 3);

    const g = res.body.items[0];
    assert.equal(g.tersedia, true);
    assert.equal(g.jarakM, 3000);
    // OSRM: 3000 m / 10 m/dtk = 300 dtk untuk 3300 m → disesuaikan ke panjang OSM 3000 m.
    assert.ok(Math.abs(g.durasiNormalS - 273) <= 2, `normal ${g.durasiNormalS}`);
    assert.equal(g.laporan, 1);
    assert.ok(g.durasiS > g.durasiNormalS);
    assert.equal(g.segmen[0].tingkat, 'macet');
    assert.equal(g.garis.length, 3);
    assert.equal(g.sumberGaris, 'osm');
    const k = res.body.items[1];
    assert.equal(k.tingkat, null);
    assert.equal(k.durasiS, k.durasiNormalS);

    // Panggilan kedua memakai cache waktu normal, tapi laporan tetap terbaru.
    await TrafficReport.deleteMany({});
    const lagi = await request(app).get('/api/traffic/corridors');
    assert.equal(panggilanOsrm.length, 2);
    assert.equal(lagi.body.items[0].laporan, 0);
  });

  test('OSRM gagal total → 502', async () => {
    await seedKoridor();
    osrmGagal = true;
    const res = await request(app).get('/api/traffic/corridors');
    assert.equal(res.status, 502);
    assert.equal(res.body.code, 'LAYANAN_PETA_GAGAL');
  });

  test('penyedia lain bisa dipasang tanpa mengubah rute', async () => {
    const palsu = {
      nama: 'uji',
      kejadianDiArea: async () => [{ id: 'x', sumber: 'uji' }],
      estimasiKoridor: async () => ({ jarakM: 1, durasiNormalS: 1, durasiS: 2, tingkat: 'padat', laporan: 0, kejadian: [], ditutup: false, garis: [], segmen: [] }),
    };
    const app2 = createApp({ jwtSecret: 'rahasia-tes', nodeEnv: 'test', mailer: { send: async () => {} }, traffic: palsu });
    const a = await request(app2).get('/api/traffic?bbox=98.6,3.5,98.7,3.6');
    assert.equal(a.body.sumber, 'uji');
    assert.equal(a.body.items[0].sumber, 'uji');
    await seedKoridor();
    const b = await request(app2).get('/api/traffic/corridors');
    assert.equal(b.body.sumber, 'uji');
    assert.equal(b.body.items.length, 2);
    assert.ok(b.body.items.every((k) => k.tingkat === 'padat'));
  });
});
