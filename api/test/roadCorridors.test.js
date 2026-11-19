import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import RoadCorridor from '../src/models/RoadCorridor.js';
import {
  KORIDOR_JALAN,
  RELASI_MEDAN,
  gabungRuas,
  imporKoridorJalan,
  kueriKoridorJalan,
  olahKoridorJalan,
} from '../src/services/roadCorridors.js';

process.env.NODE_ENV = 'test';
let mongod;

// Way OSM palsu: titik [lat, lng] berurutan, id simpul diberikan.
let idWay = 1;
const way = (nama, highway, simpul) => ({
  type: 'way',
  id: idWay++,
  tags: { name: nama, highway, oneway: 'yes' },
  nodes: simpul.map((s) => s.id),
  geometry: simpul.map((s) => ({ lat: s.lat, lon: s.lng })),
});
const s = (id, lat, lng) => ({ id, lat, lng });
const M = 1 / 110574; // derajat lintang per meter

// Jalan dua jalur ke utara ±2 km: jalur kiri & kanan (selisih 15 m), tersambung di kedua ujung.
function jalanDuaJalur(nama, idAwal = 100) {
  const lng = 98.67;
  const kiri = [];
  const kanan = [];
  for (let i = 0; i <= 20; i++) {
    kiri.push(s(idAwal + i, 3.58 + i * 100 * M, lng));
    kanan.push(s(idAwal + 100 + i, 3.58 + i * 100 * M, lng + 15 / 111000));
  }
  kanan[0] = kiri[0];
  kanan[20] = kiri[20];
  return [way(nama, 'primary', kiri.slice(0, 11)), way(nama, 'primary', kiri.slice(10)), way(nama, 'primary', [...kanan].reverse())];
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await RoadCorridor.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await RoadCorridor.deleteMany({});
});

describe('gabung ruas OSM jadi satu garis', () => {
  test('jalan dua jalur → satu garis ujung ke ujung, tidak berputar balik', () => {
    const g = gabungRuas(jalanDuaJalur('Jalan Uji'));
    assert.ok(Math.abs(g.panjangM - 2000) < 30, `panjang ${g.panjangM}`);
    const [awal, akhir] = [g.garis[0], g.garis.at(-1)];
    assert.ok(akhir[1] - awal[1] > 1900 * M, 'garis harus dari selatan ke utara');
    assert.equal(g.tidakTerpakai, 0);
    assert.ok(g.garis.length <= 4, 'garis lurus disederhanakan');
  });

  test('celah ≤ 300 m disambung; potongan jauh tidak dipakai', () => {
    const a = way('J', 'primary', [s(1, 3.58, 98.67), s(2, 3.58 + 1000 * M, 98.67)]);
    const b = way('J', 'primary', [s(3, 3.58 + 1200 * M, 98.67), s(4, 3.58 + 2500 * M, 98.67)]);
    const jauh = way('J', 'primary', [s(5, 3.7, 98.67), s(6, 3.7 + 100 * M, 98.67)]);
    const g = gabungRuas([a, b, jauh]);
    assert.ok(Math.abs(g.panjangM - 2500) < 30, `panjang ${g.panjangM}`);
    assert.equal(g.tidakTerpakai, 1);
  });

  test('tanpa ruas → null', () => {
    assert.equal(gabungRuas([]), null);
  });
});

describe('olah respons Overpass', () => {
  test('kueri dibatasi area Kota Medan dan kelas jalan utama', () => {
    const q = kueriKoridorJalan();
    assert.match(q, /area\(id:3608484616\)/);
    assert.match(q, /trunk\|primary\|secondary/);
    assert.match(q, /rel\(8484616\);\s*out geom;/);
    for (const d of KORIDOR_JALAN) assert.ok(q.includes(d.cari));
  });

  test('nama dicocokkan tepat; jalan layang & kelas lain tidak ikut', () => {
    const data = {
      elements: [
        ...jalanDuaJalur('Jalan Jenderal Gatot Subroto', 1000),
        way('Overpass Gatot Subroto', 'primary', [s(9001, 3.6, 98.6), s(9002, 3.61, 98.6)]),
        way('Jalan Gatot Subroto', 'residential', [s(9003, 3.6, 98.6), s(9004, 3.61, 98.6)]),
      ],
    };
    const { koridor, catatan } = olahKoridorJalan(data);
    assert.equal(koridor.length, 1);
    const g = koridor[0];
    assert.equal(g.kode, 'GATSU');
    assert.deepEqual(g.namaOsm, ['Jalan Jenderal Gatot Subroto']);
    assert.equal(g.jumlahWay, 3);
    assert.equal(g.jalur.type, 'LineString');
    // Koridor lain tidak ditemukan + catatan batas kota tidak ada di data uji.
    assert.equal(catatan.length, KORIDOR_JALAN.length);
  });
});

describe('dipotong ke batas Kota Medan', () => {
  // Kotak batas: lintang 3.55–3.62 (outer, dari dua way terpisah yang tidak dirangkai).
  const titik = (lat, lon) => ({ lat, lon });
  const batas = {
    type: 'relation',
    id: RELASI_MEDAN,
    members: [
      { type: 'way', role: 'outer', geometry: [titik(3.55, 98.6), titik(3.55, 98.7), titik(3.62, 98.7)] },
      { type: 'way', role: 'outer', geometry: [titik(3.62, 98.7), titik(3.62, 98.6), titik(3.55, 98.6)] },
    ],
  };

  test('way yang menjulur ke luar hanya bagian dalamnya yang dipakai', () => {
    const simpul = [];
    for (let i = 0; i <= 20; i++) simpul.push(s(7000 + i, 3.5 + i * 0.01, 98.65)); // 3.50 → 3.70
    const data = { elements: [batas, way('Jalan Jamin Ginting', 'trunk', simpul)] };
    const { koridor, catatan } = olahKoridorJalan(data);
    const [k] = koridor;
    assert.equal(k.kode, 'JAMINGINTING');
    const lat = k.jalur.coordinates.map((c) => c[1]);
    assert.ok(Math.min(...lat) >= 3.55 && Math.max(...lat) <= 3.62, `lintang ${Math.min(...lat)}–${Math.max(...lat)}`);
    assert.ok(Math.abs(k.panjangM - 0.06 * 110574) < 50, `panjang ${k.panjangM}`);
    assert.ok(!catatan.some((c) => c.kode === '-'));
  });

  test('tanpa batas di respons → tidak dipotong, ada catatan', () => {
    const { catatan } = olahKoridorJalan({ elements: jalanDuaJalur('Jalan Gagak Hitam', 8000) });
    assert.ok(catatan.some((c) => c.kode === '-'));
  });
});

describe('impor ke database', () => {
  const data = () => ({ elements: jalanDuaJalur('Jalan Brigjen Katamso', 5000) });

  test('aman diulang: baru → tetap → diperbarui; koreksi admin tidak ditimpa', async () => {
    const hasil = olahKoridorJalan(data());
    assert.deepEqual(await imporKoridorJalan(hasil), { baru: 1, diperbarui: 0, tetap: 0, dikunciAdmin: 0 });
    assert.deepEqual(await imporKoridorJalan(hasil), { baru: 0, diperbarui: 0, tetap: 1, dikunciAdmin: 0 });
    assert.equal(await RoadCorridor.countDocuments(), 1);

    const geser = olahKoridorJalan(data());
    geser.koridor[0].jalur.coordinates[0] = [98.6701, 3.5801];
    assert.equal((await imporKoridorJalan(geser)).diperbarui, 1);

    const adminGaris = [[98.6, 3.5], [98.61, 3.51]];
    await RoadCorridor.updateOne({ kode: 'KATAMSO' }, { 'jalur.coordinates': adminGaris, dikoreksiAdmin: true, sumber: 'admin' });
    assert.equal((await imporKoridorJalan(hasil)).dikunciAdmin, 1);
    const doc = await RoadCorridor.findOne({ kode: 'KATAMSO' }).lean();
    assert.deepEqual(doc.jalur.coordinates, adminGaris);
  });
});
