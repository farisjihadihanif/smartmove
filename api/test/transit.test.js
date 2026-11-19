import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import TransitLine from '../src/models/TransitLine.js';
import TransitStop from '../src/models/TransitStop.js';
import { createOverpass, kueriTransit } from '../src/services/overpass.js';
import {
  olahOverpass,
  rangkaiJalur,
  susunJalur,
  pisahPulangPergi,
  namaBalik,
  buatKode,
  bacaTarif,
} from '../src/services/osmTransit.js';
import { imporTransit } from '../src/services/transitImport.js';

process.env.NODE_ENV = 'test';
let mongod;

// ---- Data palsu bergaya respons Overpass (`out body geom` + node anggota) ----
const geom = (...pts) => pts.map(([lat, lon]) => ({ lat, lon }));
const node = (id, lat, lon, tags) => ({ type: 'node', id, lat, lon, tags });

function dataOsm({ namaK1 = 'Trans Metro Deli K1: Lapangan Merdeka – Belawan', haltePulang = [3, 2, 1] } = {}) {
  return {
    elements: [
      {
        type: 'relation',
        id: 100,
        tags: { type: 'route', route: 'bus', ref: 'K1', name: namaK1, network: 'Trans Metro Deli', colour: '#e36' },
        members: [
          { type: 'node', ref: 11, role: 'stop' },
          { type: 'node', ref: 1, role: 'platform' },
          { type: 'way', ref: 501, role: '', geometry: geom([3.5906, 98.6779], [3.6, 98.68]) },
          // way kedua tersimpan terbalik → harus dibalik saat dirangkai
          { type: 'way', ref: 502, role: '', geometry: geom([3.7, 98.67], [3.65, 98.675], [3.6, 98.68]) },
          { type: 'node', ref: 2, role: 'platform_entry_only' },
          { type: 'node', ref: 3, role: 'platform' },
        ],
      },
      {
        type: 'relation',
        id: 101,
        tags: { type: 'route', route: 'bus', ref: 'K1', name: 'Trans Metro Deli K1: Belawan – Lapangan Merdeka', network: 'Trans Metro Deli' },
        members: [
          ...haltePulang.map((ref) => ({ type: 'node', ref, role: 'platform' })),
          { type: 'way', ref: 502, role: '', geometry: geom([3.7, 98.67], [3.65, 98.675], [3.6, 98.68]) },
        ],
      },
      {
        // PTv1: tanpa peran, halte dikenali dari tag
        type: 'relation',
        id: 200,
        tags: { type: 'route', route: 'share_taxi', ref: '64', from: 'Amplas', to: 'Pinang Baris', charge: 'Rp 6.000' },
        members: [
          { type: 'node', ref: 4 },
          { type: 'node', ref: 12 }, // node biasa, bukan halte
          { type: 'way', ref: 601, geometry: geom([3.56, 98.66], [3.57, 98.65]) },
        ],
      },
      {
        type: 'relation',
        id: 300,
        tags: { type: 'route', route: 'bus', name: 'Medan – Jakarta' },
        members: [{ type: 'way', ref: 701, geometry: geom([3.59, 98.67], [1.0, 100.0], [-6.2, 106.8]) }],
      },
      { type: 'relation', id: 400, tags: { type: 'route', route: 'ferry', name: 'Belawan – Penang' }, members: [] },
      node(1, 3.5906, 98.6779, { name: 'Lapangan Merdeka', public_transport: 'platform' }),
      node(2, 3.6, 98.68, { name: 'Halte Glugur', highway: 'bus_stop' }),
      node(3, 3.7, 98.67, { name: 'Belawan', public_transport: 'platform' }),
      node(11, 3.59061, 98.67791, { public_transport: 'stop_position' }),
      node(4, 3.56, 98.66, { highway: 'bus_stop' }),
      node(12, 3.565, 98.655, {}),
    ],
  };
}

const impor = (opts) => imporTransit(olahOverpass(dataOsm(opts)));

describe('olahOverpass', () => {
  test('mengambil koridor di Mebidang, melewati antarkota & jenis tak didukung', () => {
    const h = olahOverpass(dataOsm());
    assert.deepEqual(
      h.koridor.map((k) => [k.osmId, k.jenis]),
      [
        ['relation/100', 'bus'],
        ['relation/101', 'bus'],
        ['relation/200', 'angkot'],
      ],
    );
    assert.deepEqual(
      h.dilewati.map((d) => d.osmId),
      ['relation/300', 'relation/400'],
    );
    assert.equal(h.halte.size, 4);
  });

  test('platform diutamakan (stop_position tidak ikut jadi halte ganda)', () => {
    const k1 = olahOverpass(dataOsm()).koridor[0];
    assert.deepEqual(k1.halte, ['node/1', 'node/2', 'node/3']);
    assert.equal(k1.warna, '#EE3366');
    assert.equal(k1.operator, 'Trans Metro Deli');
    assert.equal(k1.tarif, undefined);
  });

  test('PTv1: node bertag halte dipakai, tanpa nama → "Halte tanpa nama"', () => {
    const h = olahOverpass(dataOsm());
    const angkot = h.koridor[2];
    assert.deepEqual(angkot.halte, ['node/4']);
    assert.equal(angkot.nama, '64 Amplas – Pinang Baris');
    assert.equal(angkot.tarif, 6000);
    assert.equal(h.halte.get('node/4').nama, 'Halte tanpa nama');
  });

  test('jalur dirangkai menjadi satu garis searah', () => {
    const k1 = olahOverpass(dataOsm()).koridor[0];
    assert.deepEqual(k1.jalur.coordinates, [
      [98.6779, 3.5906],
      [98.68, 3.6],
      [98.675, 3.65],
      [98.67, 3.7],
    ]);
    // way pertama terbalik
    assert.deepEqual(
      rangkaiJalur([
        [
          [2, 2],
          [1, 1],
        ],
        [
          [2, 2],
          [3, 3],
        ],
      ]),
      [
        [1, 1],
        [2, 2],
        [3, 3],
      ],
    );
  });

  // Relasi TMD-K1M bergaya data asli: pergi (w1, w2) + pulang (w3) dalam satu relasi,
  // way penutup celah w1–w2 tercatat paling akhir. Koordinat [lng, lat].
  const W1 = [[98.6, 3.59], [98.62, 3.59]];
  const W2 = [[98.63, 3.59], [98.65, 3.59]];
  const W3 = [[98.65, 3.59], [98.65, 3.592], [98.6, 3.592], [98.6, 3.59]];
  const PENUTUP = [[98.62, 3.59], [98.63, 3.59]];

  test('susunJalur: way penutup celah di akhir relasi disisipkan, rute melingkar tidak berputar', () => {
    const r = susunJalur([W1, W2, W3, PENUTUP]);
    assert.deepEqual(r.garis, [
      [98.6, 3.59], [98.62, 3.59], [98.63, 3.59], [98.65, 3.59],
      [98.65, 3.592], [98.6, 3.592], [98.6, 3.59],
    ]);
    assert.equal(r.dibuangM, 0);
    assert.equal(r.celahM, 0);
  });

  test('susunJalur: celah ≤ 1,5 km disambung, potongan yang butuh lompatan jauh dibuang', () => {
    const celah = susunJalur([W1, W2]); // celah ±1,1 km
    assert.equal(celah.garis.length, 4);
    assert.ok(Math.abs(celah.celahM - 1111) < 5, `celah ${celah.celahM}`);

    const jauh = susunJalur([W1, [[98.7, 3.59], [98.701, 3.59]]]); // lompatan ±8,9 km
    assert.deepEqual(jauh.garis, W1);
    assert.ok(Math.abs(jauh.dibuangM - 111) < 5, `dibuang ${jauh.dibuangM}`);
  });

  test('susunJalur: rantai yang tercatat terbalik dibalik bila hanya itu yang tersambung', () => {
    const r = susunJalur([
      [[98.6, 3.59], [98.61, 3.59]],
      [[98.64, 3.59], [98.63, 3.59]],
      [[98.63, 3.59], [98.62, 3.59]],
    ]);
    assert.deepEqual(r.garis.map((p) => p[0]), [98.6, 98.61, 98.62, 98.63, 98.64]);
  });

  test('pisahPulangPergi & namaBalik', () => {
    const garis = susunJalur([W1, PENUTUP, W2, W3]).garis;
    const p = pisahPulangPergi(garis, [[98.6, 3.59], [98.65, 3.59]]);
    assert.deepEqual(p.pergi.at(-1), [98.65, 3.59]);
    assert.deepEqual(p.pulang[0], [98.65, 3.59]);
    assert.deepEqual(p.pulang.at(-1), [98.6, 3.59]);
    // halte sudah sampai awal lagi / garis tidak kembali → tidak dipisah
    assert.equal(pisahPulangPergi(garis, [[98.6, 3.59], [98.65, 3.59], [98.6, 3.5901]]), null);
    assert.equal(pisahPulangPergi([...W1, ...W2], [[98.6, 3.59], [98.65, 3.59]]), null);

    assert.equal(namaBalik('K1M : Pinang Baris → Lapangan Merdeka'), 'K1M : Lapangan Merdeka → Pinang Baris');
    assert.equal(namaBalik('Amplas – Belawan'), 'Belawan – Amplas');
    assert.equal(namaBalik('Rute 9'), 'Rute 9 (arah pulang)');
  });

  test('relasi pulang-pergi dengan halte hanya sampai tujuan → koridor pergi & pulang', () => {
    const way = (ref, pts) => ({ type: 'way', ref, role: '', geometry: pts.map(([lon, lat]) => ({ lat, lon })) });
    const h = olahOverpass({
      elements: [
        {
          type: 'relation',
          id: 77,
          tags: { type: 'route', route: 'bus', ref: 'K1M', name: 'K1M : Pinang Baris → Lapangan Merdeka', network: 'Trans Metro Deli' },
          members: [
            { type: 'node', ref: 1, role: 'stop' },
            { type: 'node', ref: 2, role: 'stop' },
            way(1, W1),
            way(2, W2),
            way(3, W3),
            way(4, PENUTUP),
          ],
        },
        node(1, 3.59, 98.6, { name: 'Pinang Baris', public_transport: 'stop_position' }),
        node(2, 3.59, 98.65, { name: 'Lapangan Merdeka', public_transport: 'stop_position' }),
      ],
    });
    assert.deepEqual(
      h.koridor.map((k) => [k.osmId, k.nama, k.halte]),
      [
        ['relation/77', 'K1M : Pinang Baris → Lapangan Merdeka', ['node/1', 'node/2']],
        ['relation/77#pulang', 'K1M : Lapangan Merdeka → Pinang Baris', ['node/2', 'node/1']],
      ],
    );
    assert.deepEqual(h.koridor[0].jalur.coordinates.at(-1), [98.65, 3.59]);
    assert.deepEqual(h.koridor[1].jalur.coordinates.at(-1), [98.6, 3.59]);
    assert.ok(h.catatan.some((c) => c.osmId === 'relation/77' && /dipisah/.test(c.pesan)));
    const pakai = new Set();
    assert.deepEqual(h.koridor.map((k) => buatKode(k, pakai)), ['TMD-K1M', 'TMD-K1M-2']);
    assert.equal(buatKode({ jenis: 'bus', osmId: 'relation/77#pulang' }, pakai), 'OSM-77-P');
  });

  test('route=bus dengan network "Angkot Kota Medan" → jenis angkot', () => {
    const h = olahOverpass({
      elements: [
        {
          type: 'relation',
          id: 1,
          tags: { type: 'route', route: 'bus', ref: 'KPUM 3', network: 'Angkot Kota Medan' },
          members: [{ type: 'way', ref: 1, geometry: geom([3.59, 98.67], [3.6, 98.68]) }],
        },
      ],
    });
    assert.equal(h.koridor[0].jenis, 'angkot');
    assert.equal(buatKode(h.koridor[0], new Set()), 'ANGKOT-KPUM-3');
    assert.deepEqual(h.koridor[0].halte, []);
  });

  test('kode koridor unik & mudah dibaca', () => {
    const pakai = new Set();
    const k = olahOverpass(dataOsm()).koridor;
    assert.deepEqual(
      k.map((x) => buatKode(x, pakai)),
      ['TMD-K1', 'TMD-K1-2', 'ANGKOT-64'],
    );
    assert.equal(buatKode({ jenis: 'bus', osmId: 'relation/9' }, pakai), 'OSM-9');
  });

  test('tarif dari tag charge', () => {
    assert.equal(bacaTarif('4000'), 4000);
    assert.equal(bacaTarif('IDR 4,000'), 4000);
    assert.equal(bacaTarif('4000-6000'), undefined);
    assert.equal(bacaTarif(undefined), undefined);
  });
});

describe('klien Overpass', () => {
  const cfg = { mapUserAgent: 'SmartMoveMedan/1.0 (+https://contoh.id)', overpassUrl: 'https://overpass.contoh/api/interpreter' };
  const balas = (status, body) => ({ ok: status < 300, status, headers: new Headers(), json: async () => body });

  test('satu POST ber-User-Agent SmartMove; 502 → tunggu berlipat, bukan beruntun', async () => {
    const panggil = [];
    const tunggu = [];
    const antre = [balas(502), balas(504), balas(200, { elements: [] })];
    const op = createOverpass(cfg, {
      fetch: async (url, opts) => {
        panggil.push({ url, opts });
        return antre.shift();
      },
      tidur: async (ms) => tunggu.push(ms),
    });
    assert.deepEqual(await op.ambil(), { elements: [] });
    assert.equal(panggil.length, 3);
    assert.deepEqual(tunggu, [30_000, 60_000]);
    assert.equal(panggil[0].opts.method, 'POST');
    assert.match(panggil[0].opts.headers['User-Agent'], /^SmartMove/);
    assert.equal(new URLSearchParams(panggil[0].opts.body).get('data'), kueriTransit());
  });

  test('Retry-After dihormati; menyerah setelah batas percobaan', async () => {
    const tunggu = [];
    let n = 0;
    const op = createOverpass(
      { ...cfg, overpassMaksCoba: 3 },
      {
        fetch: async () => {
          n++;
          return { ok: false, status: 429, headers: new Headers({ 'Retry-After': '120' }) };
        },
        tidur: async (ms) => tunggu.push(ms),
      },
    );
    await assert.rejects(op.ambil(), /gagal setelah 3 percobaan/);
    assert.equal(n, 3);
    assert.deepEqual(tunggu, [120_000, 120_000]);
  });

  test('galat permanen (400) tidak diulang; runtime error 200 diulang', async () => {
    let n = 0;
    const op = createOverpass(cfg, { fetch: async () => (n++, balas(400)), tidur: async () => {} });
    await assert.rejects(op.ambil(), /HTTP 400/);
    assert.equal(n, 1);

    const antre = [balas(200, { elements: [], remark: 'runtime error: Query timed out' }), balas(200, { elements: [1] })];
    const op2 = createOverpass(cfg, { fetch: async () => antre.shift(), tidur: async () => {} });
    assert.deepEqual(await op2.ambil(), { elements: [1] });
  });
});

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([TransitLine.init(), TransitStop.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('imporTransit', () => {
  beforeEach(async () => {
    await Promise.all([TransitLine.deleteMany({}), TransitStop.deleteMany({})]);
  });

  test('impor pertama menyimpan koridor & halte bertanda sumber osm', async () => {
    const r = await impor();
    assert.deepEqual(r.koridor, { baru: 3, diperbarui: 0, tetap: 0, dikunciAdmin: 0 });
    assert.deepEqual(r.halte, { baru: 4, diperbarui: 0, tetap: 0, dikunciAdmin: 0 });
    const k1 = await TransitLine.findOne({ kode: 'TMD-K1' }).lean();
    assert.equal(k1.sumber, 'osm');
    assert.equal(k1.osmId, 'relation/100');
    assert.equal(k1.tarif, null);
    assert.equal((await TransitLine.findOne({ kode: 'ANGKOT-64' })).tarif, 6000);
    assert.equal((await TransitLine.findOne({ kode: 'ANGKOT-64' })).tarifSumber, 'osm');
    const glugur = await TransitStop.findOne({ osmId: 'node/2' }).lean();
    assert.equal(glugur.sumber, 'osm');
    assert.equal(glugur.lines.length, 2); // dilewati K1 pergi & pulang
  });

  test('impor ulang tidak membuat data ganda dan tidak mengubah apa pun', async () => {
    await impor();
    const sebelum = await TransitLine.find().sort({ kode: 1 }).lean();
    const r = await impor();
    assert.deepEqual(r.koridor, { baru: 0, diperbarui: 0, tetap: 3, dikunciAdmin: 0 });
    assert.deepEqual(r.halte, { baru: 0, diperbarui: 0, tetap: 4, dikunciAdmin: 0 });
    assert.equal(await TransitLine.countDocuments(), 3);
    assert.equal(await TransitStop.countDocuments(), 4);
    const sesudah = await TransitLine.find().sort({ kode: 1 }).lean();
    assert.deepEqual(
      sesudah.map((l) => [l.kode, l.diperbaruiPada.getTime()]),
      sebelum.map((l) => [l.kode, l.diperbaruiPada.getTime()]),
    );
    const glugur = await TransitStop.findOne({ osmId: 'node/2' }).lean();
    assert.equal(glugur.lines.length, 2);
  });

  test('data yang dikoreksi admin tidak ditimpa; tarif isian admin tetap', async () => {
    await impor();
    await TransitLine.updateOne({ kode: 'TMD-K1' }, { nama: 'K1 versi admin', tarif: 4000, dikoreksiAdmin: true });
    await TransitLine.updateOne({ kode: 'TMD-K1-2' }, { tarif: 4500 }); // tarif diisi, belum dikunci
    await TransitStop.updateOne({ osmId: 'node/1' }, { nama: 'Halte Lapangan Merdeka (admin)', dikoreksiAdmin: true });

    // OSM berubah: nama K1 diganti, K1 pulang tidak lagi lewat Glugur
    const r = await impor({ namaK1: 'TMD K1 (baru di OSM)', haltePulang: [3, 1] });
    assert.equal(r.koridor.dikunciAdmin, 1);
    assert.equal(r.halte.dikunciAdmin, 1);

    const k1 = await TransitLine.findOne({ kode: 'TMD-K1' }).lean();
    assert.equal(k1.nama, 'K1 versi admin');
    assert.equal(k1.tarif, 4000);
    assert.equal((await TransitLine.findOne({ kode: 'TMD-K1-2' })).tarif, 4500);

    const merdeka = await TransitStop.findOne({ osmId: 'node/1' }).lean();
    assert.equal(merdeka.nama, 'Halte Lapangan Merdeka (admin)');

    // Glugur hanya tinggal dilewati K1 pergi (milik admin, daftar haltenya dibiarkan)
    const glugur = await TransitStop.findOne({ osmId: 'node/2' }).lean();
    assert.deepEqual(glugur.lines.map((l) => String(l.line)), [String(k1._id)]);
    assert.equal(r.halte.diperbarui, 1);
  });

  test('keanggotaan koridor buatan admin di halte OSM dipertahankan', async () => {
    await impor();
    const admin = await TransitLine.create({ kode: 'ADM-1', nama: 'Feeder admin', jenis: 'angkot', tarif: 5000 });
    await TransitStop.updateOne({ osmId: 'node/3' }, { $push: { lines: { line: admin._id, urutan: 0 } } });
    await impor();
    const belawan = await TransitStop.findOne({ osmId: 'node/3' }).lean();
    assert.ok(belawan.lines.some((l) => String(l.line) === String(admin._id)));
    assert.equal(belawan.lines.length, 3);
  });

  test('koridor yang hilang dari OSM tidak dihapus, hanya dilaporkan', async () => {
    await impor();
    const data = dataOsm();
    data.elements = data.elements.filter((e) => e.id !== 200 || e.type !== 'relation');
    const r = await imporTransit(olahOverpass(data));
    assert.equal(r.hilangDariOsm, 1);
    assert.ok(await TransitLine.exists({ kode: 'ANGKOT-64' }));
  });
});

describe('GET /transit', () => {
  let app;

  before(async () => {
    app = createApp({ jwtSecret: 'rahasia-tes', nodeEnv: 'test', mailer: { send: async () => {} } });
    await Promise.all([TransitLine.deleteMany({}), TransitStop.deleteMany({})]);
    await impor();
    await TransitLine.create({ kode: 'LAMA-1', nama: 'Disembunyikan', jenis: 'bus', aktif: false });
  });

  test('/lines: daftar koridor aktif + jumlah halte', async () => {
    const res = await request(app).get('/api/transit/lines');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.items.map((l) => [l.kode, l.jenis, l.jumlahHalte]),
      [
        ['ANGKOT-64', 'angkot', 1],
        ['TMD-K1', 'bus', 3],
        ['TMD-K1-2', 'bus', 3],
      ],
    );
    // Tarif kosong → bawaan bus listrik (Kepwal 550/16.K), ditandai perkiraan.
    assert.equal(res.body.items[1].tarif, 5000);
    assert.equal(res.body.items[1].tarifPerkiraan, true);
    assert.ok(res.body.items[1].diperbaruiPada);
    assert.equal(res.body.items[1].osmId, undefined);

    const bus = await request(app).get('/api/transit/lines?jenis=angkot');
    assert.deepEqual(bus.body.items.map((l) => l.kode), ['ANGKOT-64']);
    assert.equal((await request(app).get('/api/transit/lines?jenis=ojek')).status, 400);
  });

  test('/lines/:kode: garis + halte berurutan', async () => {
    const res = await request(app).get('/api/transit/lines/tmd-k1-2');
    assert.equal(res.status, 200);
    assert.equal(res.body.line.kode, 'TMD-K1-2');
    assert.deepEqual(res.body.line.halte.map((h) => [h.nama, h.urutan]), [
      ['Belawan', 0],
      ['Halte Glugur', 1],
      ['Lapangan Merdeka', 2],
    ]);
    assert.deepEqual(res.body.line.halte[2].lokasi, { lat: 3.5906, lng: 98.6779 });
    assert.equal(res.body.line.garis.length, 3);
    assert.equal((await request(app).get('/api/transit/lines/TIDAK-ADA')).status, 404);
    assert.equal((await request(app).get('/api/transit/lines/LAMA-1')).status, 404);
  });

  test('/stops: halte terdekat dalam radius + koridornya', async () => {
    const res = await request(app).get('/api/transit/stops?near=3.5910,98.6780');
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    const h = res.body.items[0];
    assert.equal(h.nama, 'Lapangan Merdeka');
    assert.ok(h.jarakM < 100);
    assert.deepEqual(h.koridor.map((k) => k.kode).sort(), ['TMD-K1', 'TMD-K1-2']);

    const jauh = await request(app).get('/api/transit/stops?near=3.5910,98.6780&radius=3000');
    // urut terdekat; halte angkot (±3,5 km) dan Belawan (±12 km) di luar radius
    assert.deepEqual(jauh.body.items.map((x) => x.nama), ['Lapangan Merdeka', 'Halte Glugur']);
    assert.ok(jauh.body.items[0].jarakM < jauh.body.items[1].jarakM);
  });

  test('/stops: validasi near & radius', async () => {
    assert.equal((await request(app).get('/api/transit/stops')).status, 400);
    assert.equal((await request(app).get('/api/transit/stops?near=abc')).status, 400);
    assert.equal((await request(app).get('/api/transit/stops?near=3.59,98.67&radius=99999')).status, 400);
    const luar = await request(app).get('/api/transit/stops?near=-6.2,106.8');
    assert.equal(luar.status, 422);
    assert.equal(luar.body.code, 'DI_LUAR_WILAYAH');
  });
});
