import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import BookableService from '../src/models/BookableService.js';
import Payment from '../src/models/Payment.js';
import PointLedger from '../src/models/PointLedger.js';
import { createMidtrans, hitungSignature, signatureValid, statusDariMidtrans } from '../src/services/midtrans.js';
import { dariWib, kedaluwarsakanPembayaran, wib } from '../src/services/payments.js';

process.env.NODE_ENV = 'test';
const SERVER_KEY = 'SB-Mid-server-kunci-tes';
const HARI = 24 * 60 * 60 * 1000;

let rs;
let app;
let midtrans;
// Midtrans palsu: setiap panggilan dicatat; jawaban bisa diganti per tes.
let panggilan;
let jawabCharge;
let jawabStatus;

async function fetchPalsu(url, opts = {}) {
  panggilan.push({ url, opts, body: opts.body ? JSON.parse(opts.body) : null });
  const isi = url.endsWith('/charge') ? jawabCharge(url, opts) : jawabStatus(url, opts);
  if (isi instanceof Error) throw isi;
  return { ok: isi.status < 400, status: isi.status, json: async () => isi.body };
}

before(async () => {
  // Replica set: poin memakai transaksi MongoDB (DATABASE §4.1).
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(rs.getUri());
  await Promise.all([User.init(), Payment.init(), PointLedger.init(), BookableService.init()]);
  midtrans = createMidtrans({ midtrans: { serverKey: SERVER_KEY } }, { fetchFn: fetchPalsu });
  app = createApp({
    jwtSecret: 'rahasia-tes',
    nodeEnv: 'test',
    appUrl: 'http://localhost:5173',
    mailer: { send: async () => {} },
    midtransClient: midtrans,
    authRateLimit: { windowMs: 60_000, limit: 1000 },
  });
});

after(async () => {
  await mongoose.disconnect();
  await rs.stop();
});

beforeEach(async () => {
  await Promise.all([User, BookableService, Payment, PointLedger].map((m) => m.deleteMany({})));
  panggilan = [];
  jawabCharge = (url, opts) => {
    const b = JSON.parse(opts.body);
    const dasar = {
      status_code: '201',
      transaction_status: 'pending',
      order_id: b.transaction_details.order_id,
      gross_amount: `${b.transaction_details.gross_amount}.00`,
      payment_type: b.payment_type,
      expiry_time: '2026-11-20 10:15:00',
    };
    if (b.payment_type === 'qris') {
      return { status: 200, body: { ...dasar, qr_string: '00020101021226QRIS-PALSU', actions: [{ name: 'generate-qr-code', url: 'https://api.sandbox.midtrans.com/v2/qris/x/qr-code' }] } };
    }
    if (b.payment_type === 'gopay') {
      return { status: 200, body: { ...dasar, actions: [{ name: 'generate-qr-code', url: 'https://q' }, { name: 'deeplink-redirect', url: 'gojek://gopay/merchanttransfer?x' }] } };
    }
    if (b.payment_type === 'echannel') return { status: 200, body: { ...dasar, biller_code: '70012', bill_key: '123456789' } };
    return { status: 200, body: { ...dasar, va_numbers: [{ bank: b.bank_transfer.bank, va_number: '12345678901' }] } };
  };
  jawabStatus = () => ({ status: 200, body: { status_code: '404', status_message: "Transaction doesn't exist." } });
  await BookableService.create([
    {
      kode: 'RAILINK-KNO',
      jenis: 'kereta',
      operator: 'Railink',
      nama: 'Kereta Bandara Medan → Kualanamu',
      asal: 'Stasiun Medan',
      tujuan: 'Bandara Kualanamu',
      jadwal: ['06:40', '05:20', '20:15'],
      harga: 35000,
    },
    { kode: 'PARKIR-MERDEKA', jenis: 'parkir', nama: 'Parkir Lapangan Merdeka', asal: 'Lapangan Merdeka', harga: 5000 },
    { kode: 'TUTUP', jenis: 'travel', nama: 'Travel nonaktif', asal: 'Medan', tujuan: 'Berastagi', jadwal: ['08:00'], harga: 40000, aktif: false },
  ]);
});

async function daftar(username, { admin = false } = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@contoh.id`, password: 'rahasia123' });
  assert.equal(res.status, 201);
  if (admin) await User.updateOne({ username }, { role: 'admin' });
  return { auth: `Bearer ${res.body.token}`, id: res.body.user.id };
}

/** Jadwal kereta besok jam 06:40 WIB. */
const besok = (jam = '06:40') => dariWib(wib(Date.now() + HARI).tanggal, jam).toISOString();

function notifikasi(orderId, jumlah, extra = {}) {
  const body = {
    order_id: orderId,
    status_code: '200',
    gross_amount: `${jumlah}.00`,
    transaction_status: 'settlement',
    payment_type: 'qris',
    transaction_time: '2026-11-19 10:00:00',
    settlement_time: '2026-11-19 10:01:00',
    ...extra,
  };
  return { ...body, signature_key: hitungSignature(body, SERVER_KEY) };
}

async function pesan(auth, body = {}) {
  return request(app)
    .post('/api/payments')
    .set('Authorization', auth)
    .send({ layanan: 'RAILINK-KNO', jadwal: besok(), penumpang: 2, metode: 'qris', ...body });
}

describe('signature & status Midtrans', () => {
  test('signature SHA512 valid diterima, yang diubah ditolak', () => {
    const b = notifikasi('SM-1', 70000);
    assert.equal(signatureValid(b, SERVER_KEY), true);
    assert.equal(signatureValid({ ...b, gross_amount: '1.00' }, SERVER_KEY), false);
    assert.equal(signatureValid({ ...b, signature_key: 'abc' }, SERVER_KEY), false);
    assert.equal(signatureValid(b, 'kunci-lain'), false);
    assert.equal(signatureValid({ ...b, signature_key: undefined }, SERVER_KEY), false);
  });

  test('pemetaan status', () => {
    assert.equal(statusDariMidtrans({ transaction_status: 'settlement' }), 'lunas');
    assert.equal(statusDariMidtrans({ transaction_status: 'capture', fraud_status: 'accept' }), 'lunas');
    assert.equal(statusDariMidtrans({ transaction_status: 'capture', fraud_status: 'challenge' }), null);
    assert.equal(statusDariMidtrans({ transaction_status: 'pending' }), null);
    assert.equal(statusDariMidtrans({ transaction_status: 'deny' }), 'gagal');
    assert.equal(statusDariMidtrans({ transaction_status: 'expire' }), 'kedaluwarsa');
    assert.equal(statusDariMidtrans({ transaction_status: 'cancel' }), 'dibatalkan');
  });
});

describe('GET /payments/services', () => {
  test('hanya layanan aktif, bisa disaring asal/tujuan; slot jam urut + tersedia', async () => {
    const semua = await request(app).get('/api/payments/services');
    assert.equal(semua.status, 200);
    assert.deepEqual(semua.body.items.map((s) => s.kode).sort(), ['PARKIR-MERDEKA', 'RAILINK-KNO']);

    const tanggal = wib(Date.now() + HARI).tanggal;
    const res = await request(app).get(`/api/payments/services?asal=stasiun&tujuan=kualanamu&tanggal=${tanggal}`);
    assert.equal(res.body.items.length, 1);
    const s = res.body.items[0];
    assert.equal(s.satuan, 'orang');
    assert.deepEqual(s.jadwal, ['05:20', '06:40', '20:15']);
    assert.deepEqual(s.slot.map((x) => x.tersedia), [true, true, true]);
    assert.equal(s.slot[1].waktu, dariWib(tanggal, '06:40').toISOString());

    const parkir = await request(app).get('/api/payments/services?jenis=parkir');
    assert.equal(parkir.body.items[0].satuan, 'jam');
  });

  test('tanggal/jenis salah → 400; regex dari input di-escape', async () => {
    assert.equal((await request(app).get('/api/payments/services?tanggal=besok')).status, 400);
    assert.equal((await request(app).get('/api/payments/services?jenis=ojek')).status, 400);
    const res = await request(app).get('/api/payments/services?asal=.*');
    assert.equal(res.body.items.length, 0);
  });
});

describe('POST /payments', () => {
  test('tamu 401', async () => {
    assert.equal((await request(app).post('/api/payments').send({ layanan: 'RAILINK-KNO' })).status, 401);
  });

  test('Core API charge QRIS: Basic auth, instruksi QR + batas bayar, tanpa data Snap', async () => {
    const u = await daftar('rina');
    const res = await pesan(u.auth);
    assert.equal(res.status, 201);
    assert.match(res.body.orderId, /^SM-\d{8}-[A-Z2-9]{6}$/);
    const pay = res.body.payment;
    assert.equal(pay.status, 'menunggu');
    assert.equal(pay.jumlah, 70000);
    assert.equal(pay.metode, 'qris');
    assert.deepEqual(
      { grup: pay.instruksi.grup, qrString: pay.instruksi.qrString },
      { grup: 'qris', qrString: '00020101021226QRIS-PALSU' },
    );
    assert.equal(pay.batasBayar, '2026-11-20T03:15:00.000Z');
    assert.equal(pay.eTiket, null);
    assert.equal(pay.simulasi, true);
    assert.equal(res.body.snapToken, undefined);

    const [c] = panggilan;
    assert.equal(c.url, 'https://api.sandbox.midtrans.com/v2/charge');
    assert.equal(c.opts.headers.Authorization, `Basic ${Buffer.from(`${SERVER_KEY}:`).toString('base64')}`);
    assert.equal(c.body.payment_type, 'qris');
    assert.equal(c.body.transaction_details.gross_amount, 70000);
    assert.deepEqual(c.body.custom_expiry, { expiry_duration: 15, unit: 'minute' });
    assert.match(c.body.item_details[0].name, /^\[SIMULASI\]/);
  });

  test('virtual account, Mandiri bill, e-wallet: instruksi sesuai metode', async () => {
    const u = await daftar('rina');
    const va = (await pesan(u.auth, { metode: 'bni' })).body.payment.instruksi;
    assert.deepEqual({ grup: va.grup, bank: va.bank, nomorVa: va.nomorVa }, { grup: 'va', bank: 'bni', nomorVa: '12345678901' });
    assert.deepEqual(panggilan.at(-1).body.bank_transfer, { bank: 'bni' });
    assert.equal(panggilan.at(-1).body.custom_expiry.expiry_duration, 24 * 60);

    const m = (await pesan(u.auth, { metode: 'mandiri' })).body.payment.instruksi;
    assert.deepEqual({ kodePerusahaan: m.kodePerusahaan, kodeBayar: m.kodeBayar }, { kodePerusahaan: '70012', kodeBayar: '123456789' });
    assert.equal(panggilan.at(-1).body.payment_type, 'echannel');

    const g = (await pesan(u.auth, { metode: 'gopay' })).body.payment.instruksi;
    assert.equal(g.grup, 'ewallet');
    assert.match(g.deeplink, /^gojek:/);
    assert.match(panggilan.at(-1).body.gopay.callback_url, /\/pembayaran\/SM-/);
  });

  test('metode wajib; kartu kredit & metode tak dikenal ditolak', async () => {
    const u = await daftar('rina');
    assert.equal((await pesan(u.auth, { metode: undefined })).status, 400);
    assert.equal((await pesan(u.auth, { metode: 'credit_card' })).status, 400);
    assert.equal((await pesan(u.auth, { metode: 'kartu' })).status, 400);
    assert.equal(panggilan.length, 0);
  });

  test('validasi: jam di luar jadwal, sudah lewat, penumpang, layanan nonaktif', async () => {
    const u = await daftar('rina');
    assert.equal((await pesan(u.auth, { jadwal: besok('07:00') })).status, 400);
    assert.equal((await pesan(u.auth, { jadwal: new Date(Date.now() - HARI).toISOString() })).status, 400);
    assert.equal((await pesan(u.auth, { jadwal: new Date(Date.now() + 40 * HARI).toISOString() })).status, 400);
    assert.equal((await pesan(u.auth, { penumpang: 0 })).status, 400);
    assert.equal((await pesan(u.auth, { penumpang: 9 })).status, 400);
    assert.equal((await pesan(u.auth, { layanan: 'TUTUP', jadwal: besok('08:00') })).status, 404);
    assert.equal(await Payment.countDocuments(), 0);
  });

  test('parkir: penumpang = jam, waktu bebas', async () => {
    const u = await daftar('rina');
    const res = await pesan(u.auth, { layanan: 'PARKIR-MERDEKA', jadwal: new Date(Date.now() + 60_000).toISOString(), penumpang: 3 });
    assert.equal(res.status, 201);
    assert.equal(res.body.payment.jumlah, 15000);
  });

  test('charge ditolak Midtrans → 502 PEMBAYARAN_GAGAL dan Payment tidak tertinggal', async () => {
    const u = await daftar('rina');
    jawabCharge = () => ({ status: 200, body: { status_code: '402', status_message: 'Payment channel is not activated.' } });
    const res = await pesan(u.auth);
    assert.equal(res.status, 502);
    assert.equal(res.body.code, 'PEMBAYARAN_GAGAL');
    assert.equal(await Payment.countDocuments(), 0);
  });
});

describe('POST /payments/notification', () => {
  async function buatPesanan() {
    const u = await daftar('rina');
    const res = await pesan(u.auth);
    return { u, orderId: res.body.orderId };
  }

  test('signature salah → 403, status tidak berubah', async () => {
    const { orderId } = await buatPesanan();
    const b = { ...notifikasi(orderId, 70000), signature_key: 'f'.repeat(128) };
    const res = await request(app).post('/api/payments/notification').send(b);
    assert.equal(res.status, 403);
    assert.equal((await Payment.findOne({ orderId })).status, 'menunggu');
  });

  test('gross_amount tidak sama dengan jumlah → 400', async () => {
    const { orderId } = await buatPesanan();
    const res = await request(app).post('/api/payments/notification').send(notifikasi(orderId, 1000));
    assert.equal(res.status, 400);
    assert.equal((await Payment.findOne({ orderId })).status, 'menunggu');
  });

  test('order tak dikenal → 404', async () => {
    const res = await request(app).post('/api/payments/notification').send(notifikasi('SM-X', 1000));
    assert.equal(res.status, 404);
  });

  test('settlement → lunas + e-tiket + 1 poin/Rp1.000; notifikasi ganda idempoten', async () => {
    const { u, orderId } = await buatPesanan();
    const b = notifikasi(orderId, 70000, { masked_card: '481111-1114', card_type: 'credit' });
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/payments/notification').send(b);
      assert.equal(res.status, 200);
    }
    const p = await Payment.findOne({ orderId }).select('+midtransRaw');
    assert.equal(p.status, 'lunas');
    assert.equal(p.metode, 'qris');
    assert.match(p.eTiket.kode, /^SIM-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(p.dibayarPada.toISOString(), '2026-11-19T03:01:00.000Z');
    assert.equal(p.midtransRaw.masked_card, undefined);
    assert.equal(p.midtransRaw.transaction_status, 'settlement');

    assert.equal(await PointLedger.countDocuments({ alasan: 'pembayaran', ref: orderId }), 1);
    assert.equal((await User.findById(u.id)).poin, 70);

    // Notifikasi paralel juga tidak menggandakan poin.
    const kode = p.eTiket.kode;
    await Promise.all([1, 2, 3].map(() => request(app).post('/api/payments/notification').send(b)));
    assert.equal((await User.findById(u.id)).poin, 70);
    assert.equal((await Payment.findOne({ orderId })).eTiket.kode, kode);

    const detail = await request(app).get(`/api/payments/${orderId}`).set('Authorization', u.auth);
    assert.equal(detail.body.payment.eTiket.kode, kode);
    assert.equal(detail.body.payment.poin, 70);
    assert.equal(detail.body.payment.instruksi, null);
  });

  test('pending tidak mengubah status; status final tidak bisa dibalik', async () => {
    const { u, orderId } = await buatPesanan();
    await request(app).post('/api/payments/notification').send(notifikasi(orderId, 70000, { transaction_status: 'pending', status_code: '201' }));
    assert.equal((await Payment.findOne({ orderId })).status, 'menunggu');
    await request(app).post('/api/payments/notification').send(notifikasi(orderId, 70000, { transaction_status: 'expire', status_code: '407' }));
    assert.equal((await Payment.findOne({ orderId })).status, 'kedaluwarsa');
    await request(app).post('/api/payments/notification').send(notifikasi(orderId, 70000));
    assert.equal((await Payment.findOne({ orderId })).status, 'kedaluwarsa');
    assert.equal((await User.findById(u.id)).poin, 0);
  });

  test('klien tidak bisa mengubah status lewat endpoint lain', async () => {
    const { u, orderId } = await buatPesanan();
    const res = await request(app).patch(`/api/payments/${orderId}`).set('Authorization', u.auth).send({ status: 'lunas' });
    assert.equal(res.status, 404);
    assert.equal((await Payment.findOne({ orderId })).status, 'menunggu');
  });
});

describe('riwayat & cek status', () => {
  test('hanya milik sendiri; milik orang lain 404', async () => {
    const a = await daftar('rina');
    const b = await daftar('budi');
    const { body } = await pesan(a.auth);
    await pesan(b.auth);
    const list = await request(app).get('/api/payments').set('Authorization', a.auth);
    assert.equal(list.body.total, 1);
    assert.equal(list.body.items[0].orderId, body.orderId);
    assert.equal(list.body.items[0].instruksi.grup, 'qris');
    assert.equal((await request(app).get(`/api/payments/${body.orderId}`).set('Authorization', b.auth)).status, 404);
    assert.equal((await request(app).get('/api/payments')).status, 401);
  });

  test('Cek status: jawaban Midtrans bertanda tangan diterapkan seperti webhook', async () => {
    const u = await daftar('rina');
    const { body } = await pesan(u.auth);
    jawabStatus = () => ({ status: 200, body: notifikasi(body.orderId, 70000) });
    const res = await request(app).post(`/api/payments/${body.orderId}/cek`).set('Authorization', u.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.payment.status, 'lunas');
    assert.match(panggilan.at(-1).url, /api\.sandbox\.midtrans\.com\/v2\/SM-.*\/status$/);
    assert.equal((await User.findById(u.id)).poin, 70);
  });

  test('Cek status: jawaban dengan signature palsu ditolak', async () => {
    const u = await daftar('rina');
    const { body } = await pesan(u.auth);
    jawabStatus = () => ({ status: 200, body: { ...notifikasi(body.orderId, 70000), signature_key: '0'.repeat(128) } });
    const res = await request(app).post(`/api/payments/${body.orderId}/cek`).set('Authorization', u.auth);
    assert.equal(res.status, 403);
    assert.equal((await Payment.findOne({ orderId: body.orderId })).status, 'menunggu');
  });
});

describe('cron kedaluwarsa', () => {
  test('menunggu > 24 jam: tak ada di Midtrans → kedaluwarsa; sudah settlement → lunas', async () => {
    const u = await daftar('rina');
    const lama = { user: u.id, layanan: { kode: 'X', nama: 'X' }, jumlah: 5000, createdAt: new Date(Date.now() - 2 * HARI) };
    await Payment.create([
      { ...lama, orderId: 'SM-LAMA-1' },
      { ...lama, orderId: 'SM-LAMA-2' },
      { ...lama, orderId: 'SM-BARU', createdAt: new Date() },
    ]);
    jawabStatus = (url) =>
      url.includes('SM-LAMA-2')
        ? { status: 200, body: notifikasi('SM-LAMA-2', 5000) }
        : { status: 200, body: { status_code: '404' } };
    const n = await kedaluwarsakanPembayaran({ midtrans, logger: { warn() {} } });
    assert.equal(n, 2);
    const st = Object.fromEntries((await Payment.find().lean()).map((p) => [p.orderId, p.status]));
    assert.deepEqual(st, { 'SM-LAMA-1': 'kedaluwarsa', 'SM-LAMA-2': 'lunas', 'SM-BARU': 'menunggu' });
    assert.equal((await User.findById(u.id)).poin, 5);
  });
});

describe('admin /admin/payment-services', () => {
  test('CRUD katalog; kode unik; pengguna biasa 403', async () => {
    const u = await daftar('rina');
    assert.equal((await request(app).get('/api/admin/payment-services').set('Authorization', u.auth)).status, 403);
    const a = await daftar('pengelola', { admin: true });
    const baru = await request(app)
      .post('/api/admin/payment-services')
      .set('Authorization', a.auth)
      .send({ kode: 'travel-toba', jenis: 'travel', nama: 'Travel Medan → Balige', asal: 'Medan', tujuan: 'Balige', harga: 90000, jadwal: ['09:00', '07:00', '07:00'] });
    assert.equal(baru.status, 201);
    assert.equal(baru.body.service.kode, 'TRAVEL-TOBA');
    assert.deepEqual(baru.body.service.jadwal, ['07:00', '09:00']);
    const dobel = await request(app).post('/api/admin/payment-services').set('Authorization', a.auth).send({ kode: 'TRAVEL-TOBA', jenis: 'travel', nama: 'x', harga: 1 });
    assert.equal(dobel.status, 409);
    assert.equal((await request(app).post('/api/admin/payment-services').set('Authorization', a.auth).send({ kode: 'A1', jenis: 'travel', nama: 'x', harga: 1, jadwal: ['25:00'] })).status, 400);

    const id = baru.body.service.id;
    const ubah = await request(app).patch(`/api/admin/payment-services/${id}`).set('Authorization', a.auth).send({ harga: 95000, aktif: false });
    assert.equal(ubah.body.service.harga, 95000);
    assert.equal(ubah.body.service.aktif, false);
    const list = await request(app).get('/api/admin/payment-services?q=balige').set('Authorization', a.auth);
    assert.equal(list.body.total, 1);
    assert.equal((await request(app).delete(`/api/admin/payment-services/${id}`).set('Authorization', a.auth)).status, 204);
  });
});
