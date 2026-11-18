import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as models from '../src/models/index.js';
import { TRAFFIC_TTL_MS } from '../src/models/TrafficReport.js';

const { User, TrafficReport, TransitStop, Event, Payment, PointLedger, Redemption, GeoCache, Trip, TransitLine, Feedback } =
  models;

process.env.NODE_ENV = 'test';
let mongod;
const medan = { type: 'Point', coordinates: [98.6722, 3.5952] };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(Object.values(models).map((m) => m.init()));
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function indexes(Model) {
  return Model.collection.indexes();
}

function findIndex(list, key) {
  return list.find((i) => JSON.stringify(i.key) === JSON.stringify(key));
}

describe('index', () => {
  test('2dsphere di TrafficReport, TransitStop, Event', async () => {
    for (const M of [TrafficReport, TransitStop, Event]) {
      assert.ok(findIndex(await indexes(M), { lokasi: '2dsphere' }), `${M.modelName}.lokasi`);
    }
  });

  test('index unik: Payment.orderId, PointLedger(alasan, ref), Redemption.kode, GeoCache.kunci, TransitLine.kode', async () => {
    const cases = [
      [Payment, { orderId: 1 }],
      [PointLedger, { alasan: 1, ref: 1 }],
      [Redemption, { kode: 1 }],
      [GeoCache, { kunci: 1 }],
      [TransitLine, { kode: 1 }],
      [User, { email: 1 }],
      [User, { username: 1 }],
    ];
    for (const [M, key] of cases) {
      assert.equal(findIndex(await indexes(M), key)?.unique, true, `${M.modelName} ${JSON.stringify(key)}`);
    }
  });

  test('Trip(user, createdAt)', async () => {
    assert.ok(findIndex(await indexes(Trip), { user: 1, createdAt: -1 }));
  });

  test('TTL: TrafficReport.expiresAt (0 dtk) dan GeoCache.createdAt (15 menit)', async () => {
    assert.equal(findIndex(await indexes(TrafficReport), { expiresAt: 1 })?.expireAfterSeconds, 0);
    assert.equal(findIndex(await indexes(GeoCache), { createdAt: 1 })?.expireAfterSeconds, 900);
  });
});

describe('aturan data', () => {
  const uid = new mongoose.Types.ObjectId();

  test('PointLedger ganda (alasan, ref) ditolak → idempoten', async () => {
    await PointLedger.create({ user: uid, jumlah: 10, alasan: 'pembayaran', ref: 'ORD-1' });
    await assert.rejects(
      PointLedger.create({ user: uid, jumlah: 10, alasan: 'pembayaran', ref: 'ORD-1' }),
      (e) => e.code === 11000,
    );
  });

  test('TrafficReport kedaluwarsa default 2 jam', async () => {
    const r = await TrafficReport.create({ user: uid, lokasi: medan, tingkat: 'macet' });
    const selisih = r.expiresAt.getTime() - r.createdAt.getTime();
    assert.ok(Math.abs(selisih - TRAFFIC_TTL_MS) < 5000);
    assert.equal(r.kejadian, 'none');
  });

  test('TrafficReport catatan > 200 karakter ditolak', async () => {
    await assert.rejects(
      TrafficReport.create({ user: uid, lokasi: medan, tingkat: 'padat', catatan: 'x'.repeat(201) }),
      mongoose.Error.ValidationError,
    );
  });

  test('koordinat tidak valid ditolak', async () => {
    await assert.rejects(
      TransitStop.create({ nama: 'Salah', lokasi: { type: 'Point', coordinates: [200, 3] } }),
      mongoose.Error.ValidationError,
    );
  });

  test('Event tanpa lokasi tetap bisa disimpan (2dsphere aman)', async () => {
    const e = await Event.create({
      judul: 'CFD Lapangan Merdeka',
      isi: 'Car free day',
      mulai: new Date('2026-11-22T00:00:00Z'),
      selesai: new Date('2026-11-22T03:00:00Z'),
      jenis: 'cfd',
    });
    assert.equal(e.lokasi, undefined);
  });

  test('Event selesai sebelum mulai ditolak', async () => {
    await assert.rejects(
      Event.create({ judul: 'x', isi: 'x', mulai: new Date('2026-11-22'), selesai: new Date('2026-11-21') }),
      mongoose.Error.ValidationError,
    );
  });

  test('Payment default menunggu; midtransRaw tidak ikut terpilih', async () => {
    const p = await Payment.create({
      user: uid,
      orderId: 'ORD-2',
      layanan: { kode: 'TMD-K1', nama: 'Trans Metro Deli K1' },
      jumlah: 4000,
      midtransRaw: { transaction_status: 'pending' },
    });
    assert.equal(p.status, 'menunggu');
    const dibaca = await Payment.findById(p._id).lean();
    assert.equal(dibaca.midtransRaw, undefined);
    await assert.rejects(
      Payment.create({ user: uid, orderId: 'ORD-3', layanan: { kode: 'a', nama: 'b' }, jumlah: 1, status: 'aneh' }),
      mongoose.Error.ValidationError,
    );
  });

  test('Feedback rating di luar 1–5 ditolak', async () => {
    await assert.rejects(Feedback.create({ user: uid, rating: 6 }), mongoose.Error.ValidationError);
    await assert.rejects(Feedback.create({ user: uid, rating: 2.5 }), mongoose.Error.ValidationError);
  });
});
