import crypto from 'node:crypto';
import BookableService from '../models/BookableService.js';
import Payment from '../models/Payment.js';
import { httpError } from '../lib/httpError.js';
import { tr } from '../lib/i18n.js';
import { METODE, signatureValid, statusDariMidtrans } from './midtrans.js';
import { catatPoin, poinPembayaran } from './points.js';

// Pemesanan & Digital Payment — SELALU simulasi (TASK Keputusan #3, ARCHITECTURE §5.3).
// `Payment.status` hanya diubah oleh notifikasi Midtrans bertanda tangan sah (webhook atau
// jawaban status API Midtrans yang juga bertanda tangan) dan oleh cron kedaluwarsa.

export const LABEL_PENGGUNA_DIHAPUS = 'Pengguna dihapus';
export const LABEL_SIMULASI = 'Simulasi – bukan tiket resmi';
export const JENIS_LAYANAN = ['bus', 'bus_antarkota', 'kereta', 'travel', 'parkir'];
export const MAKS_PENUMPANG = 8;
export const MAKS_JAM_PARKIR = 24;
export const MAKS_HARI_PESAN = 30;
export const KEDALUWARSA_MS = 24 * 60 * 60 * 1000;

const WIB_MS = 7 * 60 * 60 * 1000;
const MENIT = 60 * 1000;
const dua = (n) => String(n).padStart(2, '0');

/** Jam dinding WIB "HH:mm" dan tanggal "YYYY-MM-DD" dari sebuah Date. */
export function wib(d) {
  const w = new Date(new Date(d).getTime() + WIB_MS);
  return {
    tanggal: `${w.getUTCFullYear()}-${dua(w.getUTCMonth() + 1)}-${dua(w.getUTCDate())}`,
    jam: `${dua(w.getUTCHours())}:${dua(w.getUTCMinutes())}`,
  };
}

/** "YYYY-MM-DD" + "HH:mm" (WIB) → Date. */
export const dariWib = (tanggal, jam) => new Date(`${tanggal}T${jam}:00+07:00`);

/**
 * Pemilik transaksi untuk tampilan admin (`/admin/payments`, T-304). Akun yang sudah dihapus
 * admin → `{ id: null, username: null, label: "Pengguna dihapus" }`; transaksinya tetap utuh.
 * `p.user` boleh berupa id atau dokumen hasil populate('user', 'username').
 */
export function pemilikPembayaran(p, bahasa = 'id') {
  if (p.penggunaDihapus || !p.user) return { id: null, username: null, label: tr(bahasa, LABEL_PENGGUNA_DIHAPUS) };
  const username = p.user.username ?? null;
  return { id: String(p.user._id ?? p.user), username, label: username };
}

export function layananPublik(s, { tanggal, now = Date.now() } = {}) {
  const out = {
    kode: s.kode,
    jenis: s.jenis,
    operator: s.operator ?? null,
    nama: s.nama,
    asal: s.asal ?? null,
    tujuan: s.tujuan ?? null,
    harga: s.harga,
    satuan: s.jenis === 'parkir' ? 'jam' : 'orang',
    jadwal: [...(s.jadwal || [])].sort(),
  };
  if (tanggal) {
    out.tanggal = tanggal;
    out.slot = out.jadwal.map((jam) => {
      const waktu = dariWib(tanggal, jam);
      return { jam, waktu: waktu.toISOString(), tersedia: waktu.getTime() > now };
    });
  }
  return out;
}

export function pembayaranPublik(p, bahasa = 'id') {
  const lunas = p.status === 'lunas';
  return {
    orderId: p.orderId,
    layanan: {
      kode: p.layanan.kode,
      nama: p.layanan.nama,
      jenis: p.layanan.jenis ?? null,
      operator: p.layanan.operator ?? null,
      asal: p.layanan.asal ?? null,
      tujuan: p.layanan.tujuan ?? null,
      harga: p.layanan.harga ?? null,
    },
    jadwal: p.jadwal ?? null,
    penumpang: p.penumpang,
    jumlah: p.jumlah,
    status: p.status,
    metode: p.metode ?? null,
    eTiket: lunas && p.eTiket?.kode ? { kode: p.eTiket.kode } : null,
    poin: lunas ? poinPembayaran(p.jumlah) : 0,
    // Instruksi bayar (QR / nomor VA / tautan e-wallet) hanya selama masih menunggu.
    instruksi: p.status === 'menunggu' ? (p.instruksi ?? null) : null,
    batasBayar: p.batasBayar ?? null,
    dibayarPada: p.dibayarPada ?? null,
    createdAt: p.createdAt,
    simulasi: true,
    label: tr(bahasa, LABEL_SIMULASI),
  };
}

const acak = (n) => {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I agar mudah dibaca
  const b = crypto.randomBytes(n);
  return Array.from(b, (x) => huruf[x % huruf.length]).join('');
};

export const buatOrderId = (now = new Date()) => `SM-${wib(now).tanggal.replaceAll('-', '')}-${acak(6)}`;
export const buatKodeTiket = () => `SIM-${acak(4)}-${acak(4)}`;

/** Baca & periksa body POST /payments → { layanan (dokumen), jadwal, penumpang, metode }. */
export async function bacaPesanan(body, now = Date.now()) {
  const kode = typeof body.layanan === 'string' ? body.layanan.trim().toUpperCase() : '';
  if (!kode) throw httpError(400, 'Pilih layanan yang mau dipesan');
  const layanan = await BookableService.findOne({ kode, aktif: true });
  if (!layanan) throw httpError(404, 'Layanan tidak ditemukan atau sedang tidak tersedia');

  const parkir = layanan.jenis === 'parkir';
  const maks = parkir ? MAKS_JAM_PARKIR : MAKS_PENUMPANG;
  const penumpang = body.penumpang ?? 1;
  if (!Number.isInteger(penumpang) || penumpang < 1 || penumpang > maks) {
    throw httpError(400, parkir ? `Lama parkir 1–${maks} jam` : `Jumlah penumpang 1–${maks} orang`);
  }

  const jadwal = typeof body.jadwal === 'string' ? new Date(body.jadwal) : null;
  if (!jadwal || Number.isNaN(jadwal.getTime())) throw httpError(400, 'Jadwal tidak valid');
  // Parkir boleh mulai sejak 15 menit lalu (sudah di lokasi); perjalanan harus belum berangkat.
  if (jadwal.getTime() < now - (parkir ? 15 * MENIT : 0)) {
    throw httpError(400, parkir ? 'Waktu mulai parkir sudah lewat' : 'Jadwal keberangkatan sudah lewat');
  }
  if (jadwal.getTime() > now + MAKS_HARI_PESAN * 24 * 60 * MENIT) {
    throw httpError(400, `Pemesanan paling jauh ${MAKS_HARI_PESAN} hari ke depan`);
  }
  // Perjalanan harus tepat di salah satu jam keberangkatan (WIB). Parkir tanpa jadwal = bebas.
  if (layanan.jadwal.length && !layanan.jadwal.includes(wib(jadwal).jam)) {
    throw httpError(400, 'Pilih salah satu jam keberangkatan yang tersedia');
  }

  const metode = body.metode;
  if (!METODE.includes(metode)) {
    throw httpError(400, `Pilih metode pembayaran: ${METODE.join(', ')}`);
  }
  return { layanan, jadwal, penumpang, metode };
}

/** Buat Payment `menunggu` + transaksi Core API. Midtrans gagal → Payment dihapus lagi. */
export async function buatPembayaran(user, pesanan, { midtrans, appUrl }) {
  const { layanan, jadwal, penumpang, metode } = pesanan;
  const jumlah = layanan.harga * penumpang;
  if (!Number.isInteger(jumlah) || jumlah < 1) throw httpError(400, 'Harga layanan belum valid');

  let p;
  for (let i = 0; !p; i++) {
    try {
      p = await Payment.create({
        user: user._id,
        orderId: buatOrderId(),
        layanan: {
          kode: layanan.kode,
          nama: layanan.nama,
          jenis: layanan.jenis,
          operator: layanan.operator,
          asal: layanan.asal,
          tujuan: layanan.tujuan,
          harga: layanan.harga,
        },
        jadwal,
        penumpang,
        jumlah,
        metode,
      });
    } catch (err) {
      if (err.code !== 11000 || i >= 4) throw err;
    }
  }

  try {
    const hasil = await midtrans.charge({
      orderId: p.orderId,
      jumlah,
      item: {
        id: layanan.kode,
        price: layanan.harga,
        quantity: penumpang,
        name: `[SIMULASI] ${layanan.nama}`.slice(0, 50),
      },
      pelanggan: {
        first_name: (user.namaLengkap || user.username).slice(0, 50),
        email: user.email,
      },
      metode,
      kembaliUrl: `${appUrl.replace(/\/$/, '')}/pembayaran/${p.orderId}`,
    });
    p.instruksi = hasil.instruksi;
    p.batasBayar = hasil.batasBayar;
    await p.save();
  } catch (err) {
    await Payment.deleteOne({ _id: p._id });
    throw err;
  }
  return p;
}

// Hanya field non-sensitif dari notifikasi yang disimpan (DATABASE §3.6: tanpa data kartu).
const FIELD_RAW = [
  'transaction_id',
  'transaction_status',
  'transaction_time',
  'settlement_time',
  'status_code',
  'status_message',
  'payment_type',
  'fraud_status',
  'gross_amount',
  'currency',
  'bank',
  'issuer',
  'acquirer',
  'store',
  'expiry_time',
];
const ringkasRaw = (b) => Object.fromEntries(FIELD_RAW.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

/**
 * Terapkan notifikasi Midtrans (webhook atau jawaban status API).
 * Signature salah → 403; order tak dikenal → 404; `gross_amount` beda → 400 (API_SPECS §8).
 * Hanya Payment yang masih `menunggu` yang bisa berubah (atomik), jadi notifikasi ganda aman;
 * poin pembayaran tercatat sekali per orderId (index unik PointLedger).
 * → `{ payment, berubah }`.
 */
export async function terapkanNotifikasi(body, { serverKey }) {
  if (!signatureValid(body, serverKey)) throw httpError(403, 'Tanda tangan notifikasi tidak valid');
  const p = await Payment.findOne({ orderId: String(body.order_id) });
  if (!p) throw httpError(404, 'Transaksi tidak ditemukan');
  if (Number(body.gross_amount) !== p.jumlah) throw httpError(400, 'Jumlah transaksi tidak cocok');

  const status = statusDariMidtrans(body);
  const set = { midtransRaw: ringkasRaw(body) };
  // Metode pilihan pengguna (qris, bca, gopay, …) dipertahankan; payment_type hanya cadangan.
  if (body.payment_type && !p.metode) set.metode = body.payment_type;
  if (status === 'lunas') {
    set.dibayarPada = body.settlement_time ? new Date(`${body.settlement_time.replace(' ', 'T')}+07:00`) : new Date();
    if (Number.isNaN(set.dibayarPada.getTime())) set.dibayarPada = new Date();
    set['eTiket.kode'] = buatKodeTiket();
  }
  if (status) set.status = status;

  const baru = await Payment.findOneAndUpdate({ _id: p._id, status: 'menunggu' }, { $set: set }, { returnDocument: 'after' });
  if (!baru) {
    // Sudah final sebelumnya (mis. notifikasi ganda): tidak ada yang diubah.
    if (p.status === 'lunas') await beriPoinPembayaran(p);
    return { payment: p, berubah: false };
  }
  if (baru.status === 'lunas') await beriPoinPembayaran(baru);
  return { payment: baru, berubah: Boolean(status) };
}

async function beriPoinPembayaran(p) {
  const poin = poinPembayaran(p.jumlah);
  if (!p.user || poin < 1) return;
  await catatPoin({ user: p.user, jumlah: poin, alasan: 'pembayaran', ref: p.orderId });
}

/**
 * Cron harian (ARCHITECTURE §6): Payment `menunggu` > 24 jam dicocokkan dengan status Midtrans.
 * Status final dari Midtrans diterapkan; selain itu (belum dibayar / tak ada) → `kedaluwarsa`.
 * → jumlah yang diproses.
 */
export async function kedaluwarsakanPembayaran({ midtrans, now = Date.now(), logger = console } = {}) {
  const lama = await Payment.find({ status: 'menunggu', createdAt: { $lt: new Date(now - KEDALUWARSA_MS) } })
    .limit(500)
    .lean();
  let diproses = 0;
  for (const p of lama) {
    try {
      const st = midtrans ? await midtrans.cekStatus(p.orderId) : null;
      if (st && statusDariMidtrans(st)) {
        await terapkanNotifikasi(st, { serverKey: midtrans.serverKey });
      } else {
        await Payment.updateOne({ _id: p._id, status: 'menunggu' }, { $set: { status: 'kedaluwarsa' } });
      }
      diproses++;
    } catch (err) {
      logger.warn?.(`Cron pembayaran ${p.orderId}: ${err.message}`);
    }
  }
  return diproses;
}
