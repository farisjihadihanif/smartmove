import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import GeoCache from '../src/models/GeoCache.js';
import TransitLine from '../src/models/TransitLine.js';
import TransitStop from '../src/models/TransitStop.js';
import { jarakMeter } from '../src/lib/wilayah.js';
import { bangunIndeks, formatTarif, lupakanIndeksTransit } from '../src/services/transitPlanner.js';

process.env.NODE_ENV = 'test';
let mongod;
let panggilan;
let balasan; // ({ dari, ke, url }) => { status, body }

// OSRM foot palsu: jarak = garis lurus × 1,2, nama jalan tetap.
const osrmJalan = ({ dari, ke }, faktor = 1.2) => {
  const d = jarakMeter(dari, ke) * faktor;
  return {
    status: 200,
    body: {
      code: 'Ok',
      waypoints: [{ name: 'Jalan Asal' }, { name: 'Jalan Tujuan' }],
      routes: [
        {
          distance: d,
          duration: d / 1.3,
          geometry: { type: 'LineString', coordinates: [[dari.lng, dari.lat], [ke.lng, ke.lat]] },
          legs: [{ steps: [] }],
        },
      ],
    },
  };
};

const fetchPalsu = async (url) => {
  const u = new URL(url);
  const [a, b] = decodeURIComponent(u.pathname.split('/').pop())
    .split(';')
    .map((p) => p.split(',').map(Number));
  const q = { url: u, dari: { lng: a[0], lat: a[1] }, ke: { lng: b[0], lat: b[1] } };
  panggilan.push(q);
  const r = await balasan(q);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
};

const app = () =>
  createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailer: { send: async () => {} },
    fetch: fetchPalsu,
    osrmUrlCar: 'https://osrm.contoh/mobil',
    osrmUrlFoot: 'https://osrm.contoh/kaki',
  });

const garis = (...pts) => ({ type: 'LineString', coordinates: pts.map(([lat, lng]) => [lng, lat]) });

// Jaringan uji (lat, lng):
//  ANG-A  angkot tanpa halte, barat → timur di lat 3.59 (98.60 → 98.70)
//  ANG-B  angkot tanpa halte, selatan → utara di lng 98.70 (3.59 → 3.65)
//  TMD-1  bus berhalte, barat → timur di lat 3.60, halte di 98.60 / 98.65 / 98.70
async function seed({ tarifA = null, tarifB = null } = {}) {
  const [A, B, T] = await TransitLine.create([
    { kode: 'ANG-A', nama: 'Angkot A', jenis: 'angkot', tarif: tarifA, jalur: garis([3.59, 98.6], [3.59, 98.7]) },
    { kode: 'ANG-B', nama: 'Angkot B', jenis: 'angkot', tarif: tarifB, jalur: garis([3.59, 98.7], [3.65, 98.7]) },
    { kode: 'TMD-1', nama: 'Trans Metro Deli 1', jenis: 'bus', tarif: 4000, jalur: garis([3.6, 98.6], [3.6, 98.7]) },
  ]);
  await TransitStop.create(
    [98.6, 98.65, 98.7].map((lng, urutan) => ({
      nama: `Halte ${urutan + 1}`,
      lokasi: { type: 'Point', coordinates: [lng, 3.6] },
      lines: [{ line: T._id, urutan }],
    })),
  );
  return { A, B, T };
}

const cari = (from, to) => request(app()).get('/api/routes/transit').query({ from, to });
const naik = (o) => o.bagian.filter((b) => b.jenis === 'naik');

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([GeoCache.init(), TransitLine.init(), TransitStop.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([GeoCache.deleteMany({}), TransitLine.deleteMany({}), TransitStop.deleteMany({})]);
  lupakanIndeksTransit();
  panggilan = [];
  balasan = (q) => osrmJalan(q);
});

describe('GET /routes/transit – angkot (naik-turun di mana saja)', () => {
  test('titik naik & turun = titik terdekat di garis trayek, bukan halte', async () => {
    await seed();
    const res = await cari('3.593,98.62', '3.587,98.68');
    assert.equal(res.status, 200);
    const o = res.body.opsi[0];
    assert.equal(o.transfer, 0);
    const [n] = naik(o);
    assert.equal(n.koridor.kode, 'ANG-A');
    assert.equal(n.naikDiMana, true);
    assert.equal(n.jumlahHalte, null);
    assert.equal(n.dari.halteId, null);
    assert.ok(Math.abs(n.dari.lokasi.lat - 3.59) < 1e-4 && Math.abs(n.dari.lokasi.lng - 98.62) < 1e-4);
    assert.ok(Math.abs(n.ke.lokasi.lat - 3.59) < 1e-4 && Math.abs(n.ke.lokasi.lng - 98.68) < 1e-4);
    assert.ok(Math.abs(n.jarakM - 6660) < 30, `jarak naik ${n.jarakM}`);
    // Nama titik bebas diambil dari nama jalan OSRM.
    assert.equal(n.dari.nama, 'Jalan Tujuan');
    // Jalan kaki dari OSRM foot.
    const [j1, , j2] = o.bagian;
    assert.equal(j1.jenis, 'jalan');
    assert.equal(j1.perkiraan, false);
    assert.ok(Math.abs(j1.jarakM - 400) < 10, `jalan ${j1.jarakM}`);
    assert.equal(j2.jenis, 'jalan');
    assert.equal(o.jalanM, j1.jarakM + j2.jarakM);
    assert.equal(o.totalS, o.bagian.reduce((t, b) => t + b.durasiS, 0));
    assert.ok(panggilan.every((p) => p.url.pathname.startsWith('/kaki/route/v1/foot/')));
  });

  test('tarif null → "Tarif belum tersedia", tidak dihitung 0', async () => {
    await seed();
    const o = (await cari('3.593,98.62', '3.587,98.68')).body.opsi[0];
    assert.equal(o.tarif, null);
    assert.equal(o.tarifTeks, 'Tarif belum tersedia');
    assert.equal(naik(o)[0].tarif, null);
  });

  test('arah trayek dihormati: perjalanan berlawanan tidak memakai koridor satu arah', async () => {
    await seed();
    const res = await cari('3.587,98.68', '3.593,98.62');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.opsi, []);
  });

  test('lebih dari 800 m dari trayek → tidak ada opsi', async () => {
    await seed();
    const res = await cari('3.580,98.62', '3.587,98.68'); // ±1,1 km dari ANG-A
    assert.deepEqual(res.body.opsi, []);
  });

  test('jalan kaki sebenarnya > 1.000 m → opsi dibuang', async () => {
    await seed();
    balasan = (q) => osrmJalan(q, 3); // jalan memutar jauh
    const res = await cari('3.593,98.62', '3.587,98.68');
    assert.deepEqual(res.body.opsi, []);
  });

  test('OSRM gagal → jalan kaki diperkirakan, rute tetap ada', async () => {
    await seed();
    balasan = () => ({ status: 503, body: {} });
    const res = await cari('3.593,98.62', '3.587,98.68');
    assert.equal(res.status, 200);
    const o = res.body.opsi[0];
    assert.equal(o.perkiraan, true);
    assert.equal(o.bagian[0].perkiraan, true);
    assert.equal(naik(o)[0].dari.nama, 'Titik naik terdekat');
    assert.equal(await GeoCache.countDocuments(), 0); // kegagalan tidak dicache
  });

  test('koridor nonaktif dan kereta tanpa stasiun diabaikan', async () => {
    const { A } = await seed();
    await TransitLine.updateOne({ _id: A._id }, { aktif: false });
    await TransitLine.create({ kode: 'KA-X', nama: 'Kereta X', jenis: 'kereta', jalur: garis([3.59, 98.6], [3.59, 98.7]) });
    const res = await cari('3.593,98.62', '3.587,98.68');
    assert.deepEqual(res.body.opsi, []);
  });

  test('angkot yang melayani ruas sama digabung ke koridorLain', async () => {
    await seed();
    await TransitLine.create({ kode: 'ANG-A2', nama: 'Angkot A2', jenis: 'angkot', jalur: garis([3.5901, 98.6], [3.5901, 98.7]) });
    const res = await cari('3.593,98.62', '3.587,98.68');
    assert.equal(res.body.opsi.length, 1);
    const [n] = naik(res.body.opsi[0]);
    assert.deepEqual(
      [n.koridor.kode, ...n.koridorLain.map((k) => k.kode)].sort(),
      ['ANG-A', 'ANG-A2'],
    );
  });
});

describe('GET /routes/transit – koridor berhalte', () => {
  test('naik & turun di halte terdekat (≤ 800 m), tarif dari TransitLine', async () => {
    await seed();
    const res = await cari('3.603,98.649', '3.598,98.699');
    assert.equal(res.status, 200);
    const o = res.body.opsi[0];
    const [n] = naik(o);
    assert.equal(n.koridor.kode, 'TMD-1');
    assert.equal(n.naikDiMana, false);
    assert.equal(n.dari.nama, 'Halte 2');
    assert.equal(n.ke.nama, 'Halte 3');
    assert.ok(n.dari.halteId);
    assert.deepEqual(n.dari.lokasi, { lat: 3.6, lng: 98.65 });
    assert.equal(n.jumlahHalte, 1);
    assert.equal(o.tarif, 4000);
    assert.equal(o.tarifTeks, 'Rp 4.000');
    assert.equal(o.bagian[0].ke.nama, 'Halte 2');
  });

  test('dekat garis tapi jauh dari halte → koridor berhalte tidak dipakai', async () => {
    await seed();
    // 220 m dari garis TMD-1, tapi halte terdekat ±2 km.
    const res = await cari('3.602,98.632', '3.598,98.699');
    assert.deepEqual(res.body.opsi, []);
  });

  test('halte koridor pulang-pergi diletakkan di lintasan pertama', () => {
    const id = new mongoose.Types.ObjectId();
    const [L] = bangunIndeks(
      [{ _id: id, kode: 'X', nama: 'X', jenis: 'bus', jalur: garis([3.6, 98.6], [3.6, 98.65], [3.6001, 98.6], [3.6002, 98.65]) }],
      [
        { _id: 1, nama: 'Awal', lokasi: { coordinates: [98.6, 3.6] }, lines: [{ line: id, urutan: 0 }] },
        { _id: 2, nama: 'Akhir', lokasi: { coordinates: [98.65, 3.6002] }, lines: [{ line: id, urutan: 1 }] },
      ],
    );
    assert.equal(Math.round(L.simpul[0].s), 0);
    assert.ok(Math.abs(L.simpul[1].s - 5550) < 30, `s halte akhir ${L.simpul[1].s}`);
  });
});

describe('GET /routes/transit – transfer', () => {
  test('maks. 1 transfer: ANG-A lalu ANG-B, tarif dijumlah bila semua diketahui', async () => {
    await seed({ tarifA: 3000, tarifB: 5000 });
    const res = await cari('3.593,98.62', '3.64,98.703');
    assert.equal(res.status, 200);
    const o = res.body.opsi[0];
    assert.equal(o.transfer, 1);
    assert.deepEqual(naik(o).map((n) => n.koridor.kode), ['ANG-A', 'ANG-B']);
    assert.equal(o.tarif, 8000);
    assert.equal(o.tarifTeks, 'Rp 8.000');
  });

  test('satu koridor tarifnya null → total tarif null', async () => {
    await seed({ tarifA: 3000 });
    const o = (await cari('3.593,98.62', '3.64,98.703')).body.opsi[0];
    assert.equal(o.transfer, 1);
    assert.equal(o.tarif, null);
    assert.equal(o.tarifTeks, 'Tarif belum tersedia');
    assert.deepEqual(naik(o).map((n) => n.tarif), [3000, null]);
  });

  test('butuh 2 transfer → tidak ada opsi', async () => {
    await seed();
    await TransitLine.create({ kode: 'ANG-C', nama: 'Angkot C', jenis: 'angkot', jalur: garis([3.65, 98.7], [3.65, 98.76]) });
    const res = await cari('3.593,98.62', '3.653,98.75');
    assert.deepEqual(res.body.opsi, []);
  });
});

describe('GET /routes/transit – validasi', () => {
  test('from/to salah → 400, di luar Mebidang → 422', async () => {
    assert.equal((await request(app()).get('/api/routes/transit').query({ to: '3.59,98.67' })).status, 400);
    const r = await cari('-6.2,106.8', '3.59,98.67');
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'DI_LUAR_WILAYAH');
  });

  test('formatTarif', () => {
    assert.equal(formatTarif(null), 'Tarif belum tersedia');
    assert.equal(formatTarif(4000), 'Rp 4.000');
    assert.equal(formatTarif(12500), 'Rp 12.500');
    assert.equal(formatTarif(0), 'Rp 0');
  });
});
