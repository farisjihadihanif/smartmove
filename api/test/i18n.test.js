import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { bahasaDari, terjemahPesan, tr } from '../src/lib/i18n.js';
import { teksLangkah } from '../src/services/osrm.js';
import { keTempat } from '../src/services/nominatim.js';
import { pembayaranPublik, pemilikPembayaran } from '../src/services/payments.js';
import { formatTarif } from '../src/services/transitPlanner.js';
import GeoCache from '../src/models/GeoCache.js';

// T-111: teks dari API ikut `Accept-Language` (Indonesia bawaan, Inggris untuk `en…`).

process.env.NODE_ENV = 'test';
let mongod;
let panggilanOsrm;

const OSRM_OK = {
  code: 'Ok',
  routes: [
    {
      distance: 900,
      duration: 120,
      geometry: { type: 'LineString', coordinates: [[98.6566, 3.5617], [98.6782, 3.5913]] },
      legs: [
        {
          steps: [
            { distance: 400, name: 'Jalan Dr. Mansyur', maneuver: { type: 'depart', location: [98.6566, 3.5617] } },
            { distance: 500, name: 'Jalan Pemuda', maneuver: { type: 'turn', modifier: 'left', location: [98.66, 3.57] } },
            { distance: 0, name: '', maneuver: { type: 'arrive', location: [98.6782, 3.5913] } },
          ],
        },
      ],
    },
  ],
};

const app = (extra = {}) =>
  createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailer: { send: async () => {} },
    fetch: async (url) => {
      panggilanOsrm.push(String(url));
      return { ok: true, status: 200, json: async () => OSRM_OK };
    },
    osrmUrlCar: 'https://osrm.contoh/mobil',
    osrmUrlFoot: 'https://osrm.contoh/kaki',
    ...extra,
  });

const RUTE = '/api/routes?from=3.5617,98.6566&to=3.5913,98.6782';

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
  panggilanOsrm = [];
});

describe('bahasa dari header', () => {
  test('en… → en, selain itu id', () => {
    const req = (h) => ({ get: () => h });
    assert.equal(bahasaDari(req('en-US,en;q=0.9')), 'en');
    assert.equal(bahasaDari(req('EN')), 'en');
    assert.equal(bahasaDari(req('id-ID,en;q=0.8')), 'id');
    assert.equal(bahasaDari(req('fr')), 'id');
    assert.equal(bahasaDari(req(undefined)), 'id');
  });

  test('tr mengisi {0} dan jatuh ke teks Indonesia bila belum diterjemahkan', () => {
    assert.equal(tr('en', 'Ke {0}', ['Kualanamu']), 'To Kualanamu');
    assert.equal(tr('id', 'Ke {0}', ['Kualanamu']), 'Ke Kualanamu');
    assert.equal(tr('en', 'Teks tanpa terjemahan'), 'Teks tanpa terjemahan');
  });

  test('pesan bersusun ikut diterjemahkan, termasuk nama field', () => {
    assert.equal(terjemahPesan('en', 'Nama halte wajib diisi'), 'Stop name is required');
    assert.equal(terjemahPesan('en', 'Harga harus angka bulat 0–100'), 'Price must be a whole number 0–100');
    assert.equal(terjemahPesan('en', 'Kecepatan rata-rata harus angka 5–80'), 'Average speed must be a number 5–80');
    assert.equal(terjemahPesan('id', 'Nama halte wajib diisi'), 'Nama halte wajib diisi');
  });
});

describe('teks layanan dalam bahasa Inggris', () => {
  test('langkah navigasi', () => {
    const step = (type, modifier, name, extra = {}) => ({ name, maneuver: { type, modifier, ...extra } });
    const cases = [
      [step('depart', undefined, 'Jalan Gatot Subroto'), 'Start on Jalan Gatot Subroto'],
      [step('turn', 'left', 'Jalan Pemuda'), 'Turn left onto Jalan Pemuda'],
      [step('turn', 'slight right', 'Jalan Pemuda'), 'Turn slightly right onto Jalan Pemuda'],
      [step('turn', 'uturn', 'Jalan Pemuda'), 'Make a U-turn on Jalan Pemuda'],
      [step('roundabout', undefined, 'Jalan Balai Kota', { exit: 2 }), 'Enter the roundabout and take the second exit onto Jalan Balai Kota'],
      [step('continue', 'straight', ''), 'Continue straight'],
      [step('arrive', 'left', ''), 'Arrive at your destination, on the left'],
    ];
    for (const [s, teks] of cases) assert.equal(teksLangkah(s, 'en'), teks);
    assert.equal(teksLangkah(step('turn', 'left', 'Jalan Pemuda')), 'Belok kiri ke Jalan Pemuda');
  });

  test('tarif, tempat tanpa nama, label pembayaran', () => {
    assert.equal(formatTarif(null, 'en'), 'Fare not available yet');
    assert.equal(formatTarif(12500, 'en'), 'Rp 12,500');
    assert.equal(formatTarif(12500), 'Rp 12.500');
    assert.equal(keTempat({ lat: '3.5', lon: '98.6' }, 'en').nama, 'Unnamed location');
    assert.equal(keTempat({ lat: '3.5', lon: '98.6' }).nama, 'Lokasi tanpa nama');

    const p = { orderId: 'SM-1', layanan: { kode: 'A', nama: 'B' }, penumpang: 1, jumlah: 1000, status: 'menunggu' };
    assert.equal(pembayaranPublik(p, 'en').label, 'Simulation – not an official ticket');
    assert.equal(pembayaranPublik(p).label, 'Simulasi – bukan tiket resmi');
    assert.equal(pemilikPembayaran({ penggunaDihapus: true }, 'en').label, 'Deleted user');
  });
});

describe('HTTP', () => {
  test('pesan galat ikut Accept-Language; Vary dipasang', async () => {
    const en = await request(app()).get('/api/routes?from=x&to=3.5,98.6').set('Accept-Language', 'en-US');
    assert.equal(en.status, 400);
    assert.equal(en.body.message, 'Parameter from must be lat,lng');
    assert.match(en.headers.vary, /Accept-Language/i);

    const id = await request(app()).get('/api/routes?from=x&to=3.5,98.6');
    assert.equal(id.body.message, 'Parameter from harus berformat lat,lng');
  });

  test('kode galat tidak ikut diterjemahkan', async () => {
    const res = await request(app()).get('/api/routes?from=2.0,90.0&to=3.5913,98.6782').set('Accept-Language', 'en');
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'DI_LUAR_WILAYAH');
    assert.notEqual(res.body.message, undefined);
  });

  test('langkah rute per bahasa, cache tidak tercampur', async () => {
    const a = app();
    const en = await request(a).get(RUTE).set('Accept-Language', 'en');
    assert.equal(en.status, 200);
    assert.equal(en.body.langkah[1].teks, 'Turn left onto Jalan Pemuda');

    const id = await request(a).get(RUTE).set('Accept-Language', 'id-ID');
    assert.equal(id.body.langkah[1].teks, 'Belok kiri ke Jalan Pemuda');

    const lagi = await request(a).get(RUTE).set('Accept-Language', 'en');
    assert.equal(lagi.body.langkah[1].teks, 'Turn left onto Jalan Pemuda');
    assert.equal(panggilanOsrm.length, 2); // satu per bahasa, ketiga dari cache
  });

  test('sapaan Beranda', async () => {
    const pagi = new Date('2026-11-19T00:30:00Z'); // 07.30 WIB
    const res = await request(app({ now: () => pagi })).get('/api/home').set('Accept-Language', 'en');
    assert.equal(res.status, 200);
    assert.equal(res.body.sapaan.salam, 'Good morning');
    assert.equal(res.body.sapaan.teks, 'Hello! Good morning');
  });
});
