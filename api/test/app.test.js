import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { ensureAdmin } from '../src/services/adminSeed.js';
import { httpError } from '../src/lib/httpError.js';
import { errorHandler } from '../src/middleware/error.js';
import User from '../src/models/User.js';

process.env.NODE_ENV = 'test';
let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('app dasar', () => {
  test('GET /healthz (Render) → 200 + db, di luar /api', async () => {
    const res = await request(createApp()).get('/healthz');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true, db: true });
  });

  test('GET /api/health → ok + header helmet', async () => {
    const res = await request(createApp()).get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true, db: true });
    assert.ok(res.headers['x-content-type-options']);
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  test('rute tak dikenal → 404 {message}', async () => {
    const res = await request(createApp()).get('/api/tidak-ada');
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.message, 'string');
  });

  test('JSON rusak → 400 {message}', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{rusak');
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Format JSON tidak valid');
  });

  test('rate limit → 429 {message}', async () => {
    const app = createApp({ rateLimit: { windowMs: 60_000, limit: 2 } });
    await request(app).get('/api/health');
    await request(app).get('/api/health');
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 429);
    assert.equal(typeof res.body.message, 'string');
  });

  test('HttpError → status + {message, code}', async () => {
    const express = (await import('express')).default;
    const app = express();
    app.get('/x', async () => {
      throw httpError(422, 'Lokasi di luar wilayah Medan', 'DI_LUAR_WILAYAH');
    });
    app.use(errorHandler);
    const res = await request(app).get('/x');
    assert.equal(res.status, 422);
    assert.deepEqual(res.body, { message: 'Lokasi di luar wilayah Medan', code: 'DI_LUAR_WILAYAH' });
  });

  test('galat tak terduga → 500 tanpa bocor detail', async () => {
    const express = (await import('express')).default;
    const app = express();
    app.get('/x', () => {
      throw new Error('rahasia internal');
    });
    app.use(errorHandler);
    const res = await request(app).get('/x');
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(res.body).includes('rahasia'));
  });
});

describe('seed admin dari .env', () => {
  const admin = { email: 'Admin@Contoh.id', username: 'Admin', password: 'rahasia123' };

  test('dilewati bila variabel kosong', async () => {
    assert.equal((await ensureAdmin({})).status, 'dilewati');
  });

  test('membuat admin sekali, password di-hash', async () => {
    assert.equal((await ensureAdmin(admin)).status, 'dibuat');
    assert.equal((await ensureAdmin(admin)).status, 'sudah_ada');
    const users = await User.find({ email: 'admin@contoh.id' }).select('+password');
    assert.equal(users.length, 1);
    assert.equal(users[0].role, 'admin');
    assert.notEqual(users[0].password, admin.password);
    assert.ok(await bcrypt.compare(admin.password, users[0].password));
  });

  function loggerPalsu() {
    const pesan = [];
    return { pesan, logger: { warn: (m) => pesan.push(m) } };
  }

  for (const [nama, bentrok, field] of [
    ['email', { email: 'warga@contoh.id', username: 'warga1' }, ['email']],
    ['username', { email: 'lain@contoh.id', username: 'warga2' }, ['username']],
  ]) {
    test(`${nama} dipakai user biasa → tidak dinaikkan, tidak ada yang berubah, ada peringatan`, async () => {
      const user = await User.create({ ...bentrok, password: 'hash-lama', role: 'user' });
      const sebelum = await User.findById(user._id).select('+password').lean();
      const { pesan, logger } = loggerPalsu();

      const env = {
        email: nama === 'email' ? 'Warga@Contoh.id' : 'admin-baru@contoh.id',
        username: nama === 'username' ? 'Warga2' : 'adminbaru',
        password: 'rahasia123',
      };
      const hasil = await ensureAdmin(env, { logger });

      assert.equal(hasil.status, 'bentrok');
      assert.deepEqual(hasil.field, field);
      assert.equal(pesan.length, 1);
      assert.match(pesan[0], /user biasa/);
      assert.ok(!pesan[0].includes(env.password), 'password tidak boleh masuk log');

      const sesudah = await User.findById(user._id).select('+password').lean();
      assert.deepEqual(sesudah, sebelum);
      assert.equal(await User.countDocuments({ role: 'admin', email: env.email.toLowerCase() }), 0);
      assert.equal(await User.countDocuments({ username: env.username.toLowerCase(), role: 'admin' }), 0);
    });
  }

  test('email milik admin, username milik user biasa → tetap bentrok, tidak ada yang berubah', async () => {
    const user = await User.create({ email: 'warga3@contoh.id', username: 'warga3', password: 'x' });
    const { pesan, logger } = loggerPalsu();
    const hasil = await ensureAdmin(
      { email: admin.email, username: 'warga3', password: 'rahasia123' },
      { logger },
    );
    assert.equal(hasil.status, 'bentrok');
    assert.deepEqual(hasil.field, ['username']);
    assert.equal(pesan.length, 1);
    assert.equal((await User.findById(user._id)).role, 'user');
  });
});
