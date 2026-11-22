import express from 'express';
import { tr } from '../lib/i18n.js';
import Event from '../models/Event.js';
import PointLedger from '../models/PointLedger.js';
import Trip from '../models/Trip.js';
import { eventPublik } from '../services/campaign.js';
import kota from '../cities/index.js';

// Zona waktu kota aktif (Medan: WIB = UTC+7, tanpa musim panas).
const WIB_MS = kota.zonaWaktu.offsetMs;
const JAM_MS = 60 * 60 * 1000;
const MAKS_EVENT = 5;
const MAKS_NOTIF = 10;

const dua = (n) => String(n).padStart(2, '0');

// Kapan pengingat (event/trip) mulai tampil: 24 jam sebelum waktunya, atau saat dibuat bila lebih lambat.
// Klien membandingkan `muncul` dengan waktu terakhir notifikasi dibuka untuk menghitung "belum dibaca".
const munculPengingat = (waktu, dibuat) =>
  new Date(Math.max(new Date(waktu).getTime() - 24 * JAM_MS, dibuat ? new Date(dibuat).getTime() : 0));

// Pembagian waktu sapaan yang umum di Indonesia.
export function salamUntukJam(jam) {
  if (jam >= 4 && jam < 11) return 'Selamat pagi';
  if (jam >= 11 && jam < 15) return 'Selamat siang';
  if (jam >= 15 && jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

// Jam dinding WIB dari sebuah Date (pakai komponen UTC setelah digeser +7).
export function jamWib(now) {
  const w = new Date(now.getTime() + WIB_MS);
  return { jam: w.getUTCHours(), menit: w.getUTCMinutes(), tahun: w.getUTCFullYear(), bulan: w.getUTCMonth() };
}

// Awal bulan berjalan menurut WIB, dalam UTC.
function awalBulanWib(now) {
  const { tahun, bulan } = jamWib(now);
  return new Date(Date.UTC(tahun, bulan, 1) - WIB_MS);
}

const LABEL_POIN = {
  pembayaran: 'pembayaran',
  perjalanan: 'perjalanan',
  umpan_balik: 'umpan balik',
  tukar_voucher: 'tukar voucher',
  admin: 'admin',
};

export function homeRouter(cfg) {
  const r = express.Router();
  const sekarang = () => (cfg.now ? cfg.now() : new Date());

  r.get('/', async (req, res) => {
    const now = sekarang();
    const { jam, menit } = jamWib(now);
    const b = req.bahasa ?? 'id';
    const salam = tr(b, salamUntukJam(jam));
    const user = req.user;
    const nama = user ? user.namaLengkap || user.username : null;

    const besok = new Date(now.getTime() + 24 * JAM_MS);
    const [aktif, segera] = await Promise.all([
      Event.find({ mulai: { $lte: now }, selesai: { $gte: now } })
        .sort({ selesai: 1 })
        .limit(MAKS_EVENT),
      Event.find({ mulai: { $gt: now, $lte: besok } })
        .sort({ mulai: 1 })
        .limit(MAKS_EVENT),
    ]);

    const notifikasi = segera.map((e) => ({
      id: `event:${e.id}`,
      jenis: 'event',
      judul: e.judul,
      isi: tr(b, 'Dimulai {0} WIB', [`${dua(jamWib(e.mulai).jam)}.${dua(jamWib(e.mulai).menit)}`]),
      waktu: e.mulai,
      muncul: munculPengingat(e.mulai, e.createdAt),
      ref: e.id,
    }));

    let poin = null;
    if (user) {
      const [trips, ledger, bulanIni] = await Promise.all([
        Trip.find({ user: user._id, berangkatPada: { $gte: now, $lte: besok } })
          .sort({ berangkatPada: 1 })
          .limit(MAKS_NOTIF),
        PointLedger.find({ user: user._id, createdAt: { $gte: new Date(now.getTime() - 7 * 24 * JAM_MS) } })
          .sort({ createdAt: -1 })
          .limit(MAKS_NOTIF),
        PointLedger.aggregate([
          { $match: { user: user._id, jumlah: { $gt: 0 }, createdAt: { $gte: awalBulanWib(now) } } },
          { $group: { _id: null, total: { $sum: '$jumlah' } } },
        ]),
      ]);
      poin = { saldo: user.poin, bulanIni: bulanIni[0]?.total ?? 0 };

      for (const t of trips) {
        const w = jamWib(t.berangkatPada);
        notifikasi.push({
          id: `trip:${t.id}`,
          jenis: 'trip',
          judul: t.judul || tr(b, 'Ke {0}', [t.tujuan.nama]),
          isi: tr(b, 'Berangkat {0} WIB', [`${dua(w.jam)}.${dua(w.menit)}`]),
          waktu: t.berangkatPada,
          muncul: munculPengingat(t.berangkatPada, t.createdAt),
          ref: t.id,
        });
      }
      for (const l of ledger) {
        const tambah = l.jumlah > 0;
        notifikasi.push({
          id: `poin:${l.id}`,
          jenis: 'poin',
          judul: tambah ? tr(b, '+{0} poin', [l.jumlah]) : tr(b, '{0} poin', [l.jumlah]),
          isi: tr(b, tambah ? 'Poin dari {0}' : 'Poin dipakai untuk {0}', [tr(b, LABEL_POIN[l.alasan])]),
          waktu: l.createdAt,
          muncul: l.createdAt,
          ref: l.ref,
        });
      }
    }

    // Yang akan datang (event/trip) dulu, urut terdekat; lalu riwayat poin terbaru.
    const t = (n) => new Date(n.waktu).getTime();
    const depan = notifikasi.filter((n) => n.jenis !== 'poin').sort((a, b) => t(a) - t(b));
    const lalu = notifikasi.filter((n) => n.jenis === 'poin').sort((a, b) => t(b) - t(a));

    res.json({
      sapaan: {
        salam,
        teks: nama ? tr(b, 'Hallo! {0}, {1}', [salam, nama]) : tr(b, 'Hallo! {0}', [salam]),
        jam: `${dua(jam)}.${dua(menit)}`,
        zona: 'WIB',
        waktuServer: now.toISOString(),
      },
      poin,
      events: aktif.map((e) => eventPublik(e)),
      notifikasi: [...depan, ...lalu].slice(0, MAKS_NOTIF),
    });
  });

  return r;
}
