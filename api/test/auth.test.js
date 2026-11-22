import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import { sha256 } from '../src/routes/auth.js';

process.env.NODE_ENV = 'test';
const JWT_SECRET = 'rahasia-tes';
let mongod;
let uploadDir;
let terkirim;
let app;

const mailer = { send: async (m) => terkirim.push(m) };
const buatApp = (opts = {}) =>
  createApp({
    jwtSecret: JWT_SECRET,
    nodeEnv: 'test',
    appUrl: 'http://localhost:4200',
    uploadDir,
    mailer,
    authRateLimit: { windowMs: 60_000, limit: 1000 },
    ...opts,
  });

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.init();
  uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smartmove-up-'));
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  await fs.rm(uploadDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await User.deleteMany({});
  terkirim = [];
  app = buatApp();
});

const warga = { username: 'Budi_Medan', email: 'Budi@Contoh.id', password: 'rahasia123', namaLengkap: 'Budi' };
const daftar = (body = warga) => request(app).post('/api/auth/register').send(body);
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

describe('register', () => {
  test('201 → {user, token}, cookie httpOnly, password tidak bocor', async () => {
    const res = await daftar();
    assert.equal(res.status, 201);
    assert.equal(res.body.user.username, 'budi_medan');
    assert.equal(res.body.user.email, 'budi@contoh.id');
    assert.equal(res.body.user.role, 'user');
    assert.equal(typeof res.body.token, 'string');
    assert.ok(!JSON.stringify(res.body).includes('password'));
    const cookie = res.headers['set-cookie'].join(';');
    assert.match(cookie, /token=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const p = jwt.verify(res.body.token, JWT_SECRET);
    assert.equal(p.sub, res.body.user.id);
    assert.equal(p.v, 0);

    const db = await User.findOne({ username: 'budi_medan' }).select('+password');
    assert.notEqual(db.password, warga.password);
  });

  test('field role diabaikan → selalu user', async () => {
    const res = await daftar({ ...warga, role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'user');
    assert.equal((await User.findOne({ email: 'budi@contoh.id' })).role, 'user');
  });

  test('email/username sudah ada → 409', async () => {
    await daftar();
    const a = await daftar({ ...warga, username: 'lain' });
    assert.equal(a.status, 409);
    assert.equal(a.body.message, 'Email sudah terdaftar');
    const b = await daftar({ ...warga, email: 'lain@contoh.id' });
    assert.equal(b.status, 409);
    assert.equal(b.body.message, 'Username sudah dipakai');
  });

  for (const [nama, body] of [
    ['email salah', { ...warga, email: 'bukan-email' }],
    ['password pendek', { ...warga, password: '123' }],
    ['username aneh', { ...warga, username: 'a b' }],
    ['kosong', {}],
  ]) {
    test(`${nama} → 400`, async () => {
      const res = await daftar(body);
      assert.equal(res.status, 400);
      assert.equal(typeof res.body.message, 'string');
    });
  }

  test('ingat:false → cookie sesi (tanpa Max-Age)', async () => {
    const res = await daftar({ ...warga, ingat: false });
    assert.doesNotMatch(res.headers['set-cookie'].join(';'), /Max-Age/i);
  });
});

describe('login, me, logout', () => {
  beforeEach(() => daftar());

  test('login dengan username atau email', async () => {
    for (const id of ['budi_medan', 'BUDI@contoh.id']) {
      const res = await request(app).post('/api/auth/login').send({ username: id, password: warga.password });
      assert.equal(res.status, 200, id);
      assert.equal(res.body.user.username, 'budi_medan');
      assert.match(res.headers['set-cookie'].join(';'), /Max-Age/i);
    }
  });

  test('password salah / akun tidak ada → 401 pesan sama', async () => {
    const a = await request(app).post('/api/auth/login').send({ username: 'budi_medan', password: 'salah12345' });
    const b = await request(app).post('/api/auth/login').send({ username: 'siapa', password: 'salah12345' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });

  test('field kosong → 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'budi_medan' });
    assert.equal(res.status, 400);
  });

  test('me: tanpa token → user null; Bearer & cookie → user', async () => {
    assert.deepEqual((await request(app).get('/api/auth/me')).body, { user: null });

    const login = await request(app).post('/api/auth/login').send({ username: 'budi_medan', password: warga.password });
    const viaBearer = await request(app).get('/api/auth/me').set(bearer(login.body.token));
    assert.equal(viaBearer.body.user.username, 'budi_medan');

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'budi_medan', password: warga.password });
    assert.equal((await agent.get('/api/auth/me')).body.user.username, 'budi_medan');
  });

  test('token rusak / secret lain / tokenVersion lama → user null', async () => {
    const user = await User.findOne({ username: 'budi_medan' });
    const palsu = jwt.sign({ sub: user.id, v: 0 }, 'secret-lain');
    const lama = jwt.sign({ sub: user.id, v: 0 }, JWT_SECRET);
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
    for (const t of ['acak', palsu, lama]) {
      const res = await request(app).get('/api/auth/me').set(bearer(t));
      assert.equal(res.body.user, null);
    }
  });

  test('logout: hapus cookie; tanpa sesi → 401', async () => {
    assert.equal((await request(app).post('/api/auth/logout')).status, 401);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'budi_medan', password: warga.password });
    const res = await agent.post('/api/auth/logout');
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'].join(';'), /token=;/);
    assert.equal((await agent.get('/api/auth/me')).body.user, null);
  });

  test('rate limit login → 429', async () => {
    const ketat = buatApp({ authRateLimit: { windowMs: 60_000, limit: 2 } });
    for (let i = 0; i < 2; i++) await request(ketat).post('/api/auth/login').send({ username: 'x', password: 'y' });
    const res = await request(ketat).post('/api/auth/login').send({ username: 'x', password: 'y' });
    assert.equal(res.status, 429);
    assert.equal(typeof res.body.message, 'string');
  });
});

describe('lupa & reset password', () => {
  beforeEach(() => daftar());

  const tokenDariEmail = () => terkirim.at(-1).text.match(/token=([a-f0-9]{64})/)[1];

  test('email terdaftar → kirim tautan; hash disimpan, bukan token mentah', async () => {
    const res = await request(app).post('/api/auth/forgot').send({ email: 'BUDI@contoh.id' });
    assert.equal(res.status, 200);
    assert.equal(terkirim.length, 1);
    assert.equal(terkirim[0].to, 'budi@contoh.id');
    assert.match(terkirim[0].text, /http:\/\/localhost:4200\/reset-password\?token=/);
    const token = tokenDariEmail();
    const db = await User.findOne({ email: 'budi@contoh.id' }).select('+resetTokenHash +resetTokenExpires');
    assert.equal(db.resetTokenHash, sha256(token));
    const sisa = db.resetTokenExpires - Date.now();
    assert.ok(sisa > 29 * 60_000 && sisa <= 30 * 60_000);
  });

  test('email tidak terdaftar → respons sama, tidak ada email', async () => {
    const a = await request(app).post('/api/auth/forgot').send({ email: 'budi@contoh.id' });
    const b = await request(app).post('/api/auth/forgot').send({ email: 'tidakada@contoh.id' });
    assert.equal(b.status, 200);
    assert.equal(a.body.message, b.body.message);
    assert.equal(terkirim.length, 1);
  });

  test('mailer gagal → tetap 200 (tidak bocor)', async () => {
    const gagal = buatApp({ mailer: { send: async () => { throw new Error('smtp mati'); } } });
    const res = await request(gagal).post('/api/auth/forgot').send({ email: 'budi@contoh.id' });
    assert.equal(res.status, 200);
  });

  test('reset → password baru berlaku, sesi lama dicabut, token sekali pakai', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'budi_medan', password: warga.password });
    await request(app).post('/api/auth/forgot').send({ email: 'budi@contoh.id' });
    const token = tokenDariEmail();

    const res = await request(app).post('/api/auth/reset').send({ token, password: 'passwordbaru1' });
    assert.equal(res.status, 200);

    assert.equal((await request(app).get('/api/auth/me').set(bearer(login.body.token))).body.user, null);
    const lama = await request(app).post('/api/auth/login').send({ username: 'budi_medan', password: warga.password });
    assert.equal(lama.status, 401);
    const baru = await request(app).post('/api/auth/login').send({ username: 'budi_medan', password: 'passwordbaru1' });
    assert.equal(baru.status, 200);

    const ulang = await request(app).post('/api/auth/reset').send({ token, password: 'passwordbaru2' });
    assert.equal(ulang.status, 400);
  });

  test('token kedaluwarsa / acak → 400', async () => {
    await request(app).post('/api/auth/forgot').send({ email: 'budi@contoh.id' });
    const token = tokenDariEmail();
    await User.updateOne({ email: 'budi@contoh.id' }, { resetTokenExpires: new Date(Date.now() - 1000) });
    assert.equal((await request(app).post('/api/auth/reset').send({ token, password: 'passwordbaru1' })).status, 400);
    assert.equal(
      (await request(app).post('/api/auth/reset').send({ token: 'a'.repeat(64), password: 'passwordbaru1' })).status,
      400,
    );
    assert.equal((await request(app).post('/api/auth/reset').send({ token: { $ne: null }, password: 'passwordbaru1' })).status, 400);
  });

  test('password baru terlalu pendek → 400', async () => {
    await request(app).post('/api/auth/forgot').send({ email: 'budi@contoh.id' });
    const res = await request(app).post('/api/auth/reset').send({ token: tokenDariEmail(), password: '123' });
    assert.equal(res.status, 400);
  });
});

describe('profil', () => {
  let token;
  beforeEach(async () => {
    token = (await daftar()).body.token;
  });

  test('tanpa login → 401', async () => {
    assert.equal((await request(app).patch('/api/users/me').send({ bio: 'x' })).status, 401);
    assert.equal((await request(app).put('/api/users/me/password').send({})).status, 401);
  });

  test('ubah profil JSON; role & poin tidak bisa diubah', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set(bearer(token))
      .send({ namaLengkap: ' Budi Santoso ', telepon: '0812', bio: 'Komuter', role: 'admin', poin: 9999 });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.namaLengkap, 'Budi Santoso');
    assert.equal(res.body.user.telepon, '0812');
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.poin, 0);
  });

  test('username bentrok → 409', async () => {
    await daftar({ ...warga, username: 'sari', email: 'sari@contoh.id' });
    const res = await request(app).patch('/api/users/me').set(bearer(token)).send({ username: 'sari' });
    assert.equal(res.status, 409);
  });

  test('unggah foto PNG (multipart) → disimpan di GridFS & bisa diakses; foto lama dihapus', async () => {
    const up = () =>
      request(app)
        .patch('/api/users/me')
        .set(bearer(token))
        .field('namaLengkap', 'Budi Foto')
        .attach('foto', PNG, { filename: 'a.png', contentType: 'image/png' });

    const a = await up();
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.user.namaLengkap, 'Budi Foto');
    assert.match(a.body.user.foto, /^\/api\/files\/[a-f0-9]{24}\.png$/);
    const get = await request(app).get(a.body.user.foto);
    assert.equal(get.status, 200);
    assert.equal(get.headers['cross-origin-resource-policy'], 'cross-origin');
    assert.equal(get.headers['content-type'], 'image/png');
    assert.ok(Buffer.compare(get.body, PNG) === 0);

    const b = await up();
    assert.notEqual(b.body.user.foto, a.body.user.foto);
    assert.equal((await request(app).get(b.body.user.foto)).status, 200);
    assert.equal((await request(app).get(a.body.user.foto)).status, 404);
    assert.equal((await request(app).get('/api/files/bukan-id.png')).status, 404);
  });

  test('file bukan gambar (walau mimetype image/png) → 400', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set(bearer(token))
      .attach('foto', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' });
    assert.equal(res.status, 400);
  });

  test('foto > 2 MB → 413', async () => {
    const besar = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await request(app)
      .patch('/api/users/me')
      .set(bearer(token))
      .attach('foto', besar, { filename: 'b.png', contentType: 'image/png' });
    assert.equal(res.status, 413);
  });

  test('ganti password: lama salah → 400; berhasil → token baru, token lama dicabut', async () => {
    const salah = await request(app)
      .put('/api/users/me/password')
      .set(bearer(token))
      .send({ passwordLama: 'keliru123', passwordBaru: 'passwordbaru1' });
    assert.equal(salah.status, 400);

    const res = await request(app)
      .put('/api/users/me/password')
      .set(bearer(token))
      .send({ passwordLama: warga.password, passwordBaru: 'passwordbaru1' });
    assert.equal(res.status, 200);
    assert.equal((await request(app).get('/api/auth/me').set(bearer(token))).body.user, null);
    assert.equal((await request(app).get('/api/auth/me').set(bearer(res.body.token))).body.user.username, 'budi_medan');
  });
});
