// Pintu masuk untuk Vercel. Semua request diarahkan ke file ini (lihat
// vercel.json) dan dijalankan sebagai serverless function. Isinya sama dengan
// src/server.js, tetapi tanpa app.listen() dan tanpa setInterval:
// - koneksi MongoDB dibuka sekali per instance lalu dipakai ulang;
// - cron pembayaran dijalankan Vercel Cron lewat /api/cron/pembayaran.
import dns from 'node:dns';
import mongoose from 'mongoose';
import config, { assertConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { ensureAdmin } from '../src/services/adminSeed.js';
import { createMidtrans } from '../src/services/midtrans.js';
import { kedaluwarsakanPembayaran } from '../src/services/payments.js';

let siap = null;
let app = null;

function persiapkan() {
  if (!siap) {
    siap = (async () => {
      assertConfig();
      if (config.dnsServers.length) dns.setServers(config.dnsServers);
      await mongoose.connect(config.mongoUrl);
      const seed = await ensureAdmin(config.admin);
      console.log(`Akun admin: ${seed.status}`);
      app = createApp();
    })().catch((err) => {
      siap = null; // coba lagi di request berikutnya
      throw err;
    });
  }
  return siap;
}

// Vercel Cron mengirim header Authorization: Bearer <CRON_SECRET>.
async function cronPembayaran(req, res) {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia || req.headers.authorization !== `Bearer ${rahasia}`) {
    res.statusCode = 401;
    res.end(JSON.stringify({ message: 'Tidak diizinkan' }));
    return;
  }
  const n = await kedaluwarsakanPembayaran({ midtrans: createMidtrans(config) });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, diproses: n }));
}

// Penyebab kegagalan start dalam bentuk aman untuk ditampilkan: nama variabel
// atau jenis error saja, tanpa isi MONGO_URL atau rahasia lain.
function alasanGagal(err) {
  const pesan = String(err?.message ?? '');
  if (pesan.startsWith('Variabel lingkungan wajib belum diisi')) return pesan;
  const nama = err?.name ?? 'Error';
  if (nama === 'MongoParseError' || /Invalid scheme|URI/i.test(pesan)) return 'Format MONGO_URL salah';
  if (nama === 'MongoServerSelectionError' || /ENOTFOUND|ECONNREFUSED|ETIMEDOUT/.test(pesan)) {
    return 'Tidak bisa terhubung ke MongoDB: cek Network Access Atlas (0.0.0.0/0) dan nama cluster di MONGO_URL';
  }
  if (/auth|Authentication/i.test(pesan)) return 'Login MongoDB gagal: cek username/password di MONGO_URL';
  return `Kesalahan saat start (${nama})`;
}

export default async function handler(req, res) {
  try {
    await persiapkan();
  } catch (err) {
    console.error(err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Server belum siap, coba lagi sebentar lagi', alasan: alasanGagal(err) }));
    return;
  }
  if (req.url.split('?')[0] === '/api/cron/pembayaran') return cronPembayaran(req, res);
  return app(req, res);
}
