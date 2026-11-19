import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import Voucher from '../src/models/Voucher.js';
import Redemption from '../src/models/Redemption.js';
import PointLedger from '../src/models/PointLedger.js';
import Payment from '../src/models/Payment.js';
import Feedback from '../src/models/Feedback.js';
import { catatPoin, mingguWib } from '../src/services/points.js';
import { beriPoinUmpanBalik } from '../src/services/rewards.js';

process.env.NODE_ENV = 'test';
const HARI = 24 * 60 * 60 * 1000;
let rs;
let app;

before(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(rs.getUri());
  await Promise.all([User.init(), PointLedger.init(), Redemption.init(), Voucher.init(), Payment.init(), Feedback.init()]);
  app = createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    mailer: { send: async () => {} },
    midtransClient: { serverKey: 'x' },
    authRateLimit: { windowMs: 60_000, limit: 1000 },
  });
});

after(async () => {
  await mongoose.disconnect();
  await rs.stop();
});

beforeEach(async () => {
  await Promise.all([User, Voucher, Redemption, PointLedger, Payment, Feedback].map((m) => m.deleteMany({})));
});

async function daftar(username, { admin = false, poin = 0 } = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@contoh.id`, password: 'rahasia123' });
  assert.equal(res.status, 201);
  const id = res.body.user.id;
  if (admin) await User.updateOne({ _id: id }, { role: 'admin' });
  if (poin) await catatPoin({ user: id, jumlah: poin, alasan: 'admin', ref: `awal:${id}` });
  return { auth: `Bearer ${res.body.token}`, id };
}

const saldo = async (id) => (await User.findById(id)).poin;

describe('poin & ledger', () => {
  test('GET /rewards: saldo + riwayat ledger milik sendiri; tamu 401', async () => {
    const a = await daftar('rina', { poin: 120 });
    await daftar('budi', { poin: 50 });
    assert.equal((await request(app).get('/api/rewards')).status, 401);
    const res = await request(app).get('/api/rewards').set('Authorization', a.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.saldo, 120);
    assert.equal(res.body.total, 1);
    assert.deepEqual(
      { jumlah: res.body.items[0].jumlah, alasan: res.body.items[0].alasan, label: res.body.items[0].label },
      { jumlah: 120, alasan: 'admin', label: 'Penyesuaian admin' },
    );
  });

  test('catatPoin: saldo tidak pernah negatif & ref ganda diabaikan', async () => {
    const a = await daftar('rina', { poin: 10 });
    assert.deepEqual(await catatPoin({ user: a.id, jumlah: -11, alasan: 'admin', ref: 'x1' }), { kurang: true });
    assert.equal(await saldo(a.id), 10);
    assert.equal(await PointLedger.countDocuments({ ref: 'x1' }), 0);
    assert.equal(await catatPoin({ user: a.id, jumlah: 5, alasan: 'admin', ref: `awal:${a.id}` }), null);
    assert.equal(await saldo(a.id), 10);
  });

  test('mingguWib: Senin–Minggu menurut WIB', () => {
    assert.equal(mingguWib(new Date('2026-11-19T03:00:00Z')), '2026-11-16'); // Kamis
    assert.equal(mingguWib(new Date('2026-11-22T16:59:00Z')), '2026-11-16'); // Minggu 23.59 WIB
    assert.equal(mingguWib(new Date('2026-11-22T17:00:00Z')), '2026-11-23'); // Senin 00.00 WIB
  });
});

describe('katalog & tukar voucher', () => {
  async function voucher(extra = {}) {
    return Voucher.create({ nama: 'Diskon parkir 50%', poin: 100, stok: 5, ...extra });
  }

  test('katalog: hanya aktif & belum lewat masa berlaku; stok habis tetap tampil', async () => {
    await voucher({ nama: 'A', poin: 300 });
    await voucher({ nama: 'Habis', poin: 50, stok: 0 });
    await voucher({ nama: 'Nonaktif', aktif: false });
    await voucher({ nama: 'Lewat', berlakuSampai: new Date(Date.now() - HARI) });
    await voucher({ nama: 'Masih', poin: 200, berlakuSampai: new Date(Date.now() + HARI) });
    const res = await request(app).get('/api/rewards/vouchers');
    assert.deepEqual(res.body.items.map((v) => v.nama), ['Habis', 'Masih', 'A']);
    assert.equal(res.body.items[0].tersedia, false);
  });

  test('tukar berhasil: poin & stok berkurang, ledger negatif, kode unik', async () => {
    const a = await daftar('rina', { poin: 250 });
    const v = await voucher();
    const res = await request(app).post(`/api/rewards/vouchers/${v.id}/redeem`).set('Authorization', a.auth);
    assert.equal(res.status, 201);
    assert.equal(res.body.saldo, 150);
    assert.match(res.body.redemption.kode, /^SMV-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(res.body.redemption.status, 'aktif');
    assert.equal(res.body.redemption.voucher.nama, 'Diskon parkir 50%');
    assert.equal(await saldo(a.id), 150);
    assert.equal((await Voucher.findById(v.id)).stok, 4);
    const l = await PointLedger.findOne({ alasan: 'tukar_voucher' });
    assert.equal(l.jumlah, -100);
    assert.equal(l.ref, res.body.redemption.id);

    const saya = await request(app).get('/api/rewards/redemptions').set('Authorization', a.auth);
    assert.equal(saya.body.total, 1);
    assert.equal(saya.body.items[0].kode, res.body.redemption.kode);
  });

  test('poin kurang → 409 POIN_KURANG, tidak ada yang berubah', async () => {
    const a = await daftar('rina', { poin: 99 });
    const v = await voucher();
    const res = await request(app).post(`/api/rewards/vouchers/${v.id}/redeem`).set('Authorization', a.auth);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'POIN_KURANG');
    assert.equal(await saldo(a.id), 99);
    assert.equal((await Voucher.findById(v.id)).stok, 5);
    assert.equal(await Redemption.countDocuments(), 0);
    assert.equal(await PointLedger.countDocuments({ alasan: 'tukar_voucher' }), 0);
  });

  test('stok habis → 409 STOK_HABIS, poin tidak terpotong', async () => {
    const a = await daftar('rina', { poin: 500 });
    const v = await voucher({ stok: 0 });
    const res = await request(app).post(`/api/rewards/vouchers/${v.id}/redeem`).set('Authorization', a.auth);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'STOK_HABIS');
    assert.equal(await saldo(a.id), 500);
    assert.equal(await Redemption.countDocuments(), 0);
  });

  test('stok terakhir diperebutkan bersamaan: hanya satu yang berhasil', async () => {
    const v = await voucher({ stok: 1 });
    const orang = await Promise.all(['rina', 'budi', 'sari', 'dodi'].map((n) => daftar(n, { poin: 100 })));
    const hasil = await Promise.all(
      orang.map((o) => request(app).post(`/api/rewards/vouchers/${v.id}/redeem`).set('Authorization', o.auth)),
    );
    assert.equal(hasil.filter((r) => r.status === 201).length, 1);
    assert.ok(hasil.filter((r) => r.status !== 201).every((r) => r.body.code === 'STOK_HABIS'));
    assert.equal((await Voucher.findById(v.id)).stok, 0);
    assert.equal(await Redemption.countDocuments(), 1);
    const saldoTotal = (await User.find()).reduce((s, u) => s + u.poin, 0);
    assert.equal(saldoTotal, 300);
  });

  test('tukar paralel oleh satu orang: saldo tidak bisa minus', async () => {
    const a = await daftar('rina', { poin: 150 });
    const v = await voucher({ stok: 10 });
    const hasil = await Promise.all([1, 2, 3].map(() => request(app).post(`/api/rewards/vouchers/${v.id}/redeem`).set('Authorization', a.auth)));
    assert.equal(hasil.filter((r) => r.status === 201).length, 1);
    assert.equal(await saldo(a.id), 50);
    assert.equal((await Voucher.findById(v.id)).stok, 9);
  });

  test('voucher tak dikenal / nonaktif → 404; tamu 401', async () => {
    const a = await daftar('rina', { poin: 500 });
    const v = await voucher({ aktif: false });
    assert.equal((await request(app).post(`/api/rewards/vouchers/${v.id}/redeem`).set('Authorization', a.auth)).status, 404);
    assert.equal((await request(app).post('/api/rewards/vouchers/abc/redeem').set('Authorization', a.auth)).status, 404);
    assert.equal((await request(app).post(`/api/rewards/vouchers/${v.id}/redeem`)).status, 401);
  });

  test('voucher lewat masa berlaku tampil kedaluwarsa di Voucher saya', async () => {
    const a = await daftar('rina');
    const v = await voucher({ berlakuSampai: new Date(Date.now() - HARI) });
    await Redemption.create({ user: a.id, voucher: v.id, kode: 'SMV-AAAA-BBBB' });
    const res = await request(app).get('/api/rewards/redemptions').set('Authorization', a.auth);
    assert.equal(res.body.items[0].status, 'kedaluwarsa');
  });
});

describe('poin umpan balik', () => {
  test('5 poin, maks. 1× per minggu WIB', async () => {
    const a = await daftar('rina');
    const r1 = await request(app).post('/api/campaign/feedback').set('Authorization', a.auth).send({ rating: 5 });
    assert.equal(r1.status, 201);
    assert.equal(r1.body.poin, 5);
    const r2 = await request(app).post('/api/campaign/feedback').set('Authorization', a.auth).send({ rating: 4 });
    assert.equal(r2.status, 201);
    assert.equal(r2.body.poin, 0);
    assert.equal(await saldo(a.id), 5);

    const mingguDepan = Date.now() + 7 * HARI;
    assert.equal(await beriPoinUmpanBalik(a.id, mingguDepan), 5);
    assert.equal(await beriPoinUmpanBalik(a.id, mingguDepan), 0);
    assert.equal(await saldo(a.id), 10);
    assert.equal(await PointLedger.countDocuments({ alasan: 'umpan_balik' }), 2);
  });
});

describe('admin voucher & transaksi', () => {
  test('CRUD voucher; yang sudah ditukar tidak bisa dihapus (409)', async () => {
    const a = await daftar('pengelola', { admin: true });
    const u = await daftar('rina', { poin: 1000 });
    assert.equal((await request(app).get('/api/admin/vouchers').set('Authorization', u.auth)).status, 403);

    const baru = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', a.auth)
      .send({ nama: 'Gratis 1 jam parkir', poin: 200, stok: 10, syarat: 'Berlaku di parkir mitra.', berlakuSampai: new Date(Date.now() + 30 * HARI).toISOString() });
    assert.equal(baru.status, 201);
    assert.equal(baru.body.voucher.syarat, 'Berlaku di parkir mitra.');
    assert.equal((await request(app).post('/api/admin/vouchers').set('Authorization', a.auth).send({ nama: 'x', poin: 0, stok: 1 })).status, 400);

    const id = baru.body.voucher.id;
    await request(app).post(`/api/rewards/vouchers/${id}/redeem`).set('Authorization', u.auth);
    const list = await request(app).get('/api/admin/vouchers').set('Authorization', a.auth);
    assert.equal(list.body.items[0].ditukar, 1);
    assert.equal(list.body.items[0].stok, 9);

    const ubah = await request(app).patch(`/api/admin/vouchers/${id}`).set('Authorization', a.auth).send({ aktif: false, berlakuSampai: null });
    assert.equal(ubah.body.voucher.aktif, false);
    assert.equal(ubah.body.voucher.berlakuSampai, null);
    assert.equal((await request(app).delete(`/api/admin/vouchers/${id}`).set('Authorization', a.auth)).status, 409);

    const kosong = await request(app).post('/api/admin/vouchers').set('Authorization', a.auth).send({ nama: 'Hapus aku', poin: 1, stok: 1 });
    assert.equal((await request(app).delete(`/api/admin/vouchers/${kosong.body.voucher.id}`).set('Authorization', a.auth)).status, 204);
  });

  test('transaksi: filter status, cari, pemilik terhapus = "Pengguna dihapus"', async () => {
    const a = await daftar('pengelola', { admin: true });
    const u = await daftar('rina');
    const dasar = { layanan: { kode: 'K', nama: 'Kereta Bandara' }, jumlah: 35000 };
    await Payment.create([
      { ...dasar, user: u.id, orderId: 'SM-1', status: 'lunas' },
      { ...dasar, orderId: 'SM-2', penggunaDihapus: true },
      { ...dasar, user: u.id, orderId: 'SM-3', layanan: { kode: 'P', nama: 'Parkir Merdeka' } },
    ]);
    const semua = await request(app).get('/api/admin/payments').set('Authorization', a.auth);
    assert.equal(semua.body.total, 3);
    const p2 = semua.body.items.find((p) => p.orderId === 'SM-2');
    assert.deepEqual(p2.pengguna, { id: null, username: null, label: 'Pengguna dihapus' });
    assert.equal(semua.body.items.find((p) => p.orderId === 'SM-1').pengguna.username, 'rina');
    assert.deepEqual(semua.body.ringkasan.lunas, { jumlah: 1, nilai: 35000 });

    const lunas = await request(app).get('/api/admin/payments?status=lunas').set('Authorization', a.auth);
    assert.deepEqual(lunas.body.items.map((p) => p.orderId), ['SM-1']);
    const cari = await request(app).get('/api/admin/payments?q=parkir').set('Authorization', a.auth);
    assert.deepEqual(cari.body.items.map((p) => p.orderId), ['SM-3']);
    const olehRina = await request(app).get('/api/admin/payments?q=rina').set('Authorization', a.auth);
    assert.equal(olehRina.body.total, 2);
    assert.equal((await request(app).get('/api/admin/payments?status=aneh').set('Authorization', a.auth)).status, 400);
  });
});
