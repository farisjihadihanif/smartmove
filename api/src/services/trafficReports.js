import TrafficReport, { TRAFFIC_TTL_MS } from '../models/TrafficReport.js';
import { httpError } from '../lib/httpError.js';

// ARCHITECTURE §5.4 / Aturan Bisnis #4.
export const BATAS_PER_JAM = 5; // laporan + konfirmasi per pengguna per jam
export const RADIUS_GABUNG_M = 300;
export const JENDELA_GABUNG_MS = 30 * 60 * 1000;

export const TINGKAT = ['lancar', 'padat', 'macet'];
export const KEJADIAN = ['none', 'kecelakaan', 'banjir', 'penutupan', 'perbaikan_jalan'];

// Bentuk publik: tanpa identitas pelapor (DATABASE §5).
export function publicLaporan(r) {
  return {
    id: r.id ?? String(r._id),
    lokasi: { lat: r.lokasi.coordinates[1], lng: r.lokasi.coordinates[0] },
    tingkat: r.tingkat,
    kejadian: r.kejadian || 'none',
    catatan: r.catatan || null,
    konfirmasi: r.konfirmasi || 0,
    createdAt: r.createdAt,
    diperbaruiPada: r.updatedAt,
    expiresAt: r.expiresAt,
  };
}

// Jumlah laporan baru + konfirmasi dari pengguna ini dalam satu jam terakhir.
// Satu dokumen hanya bisa dibuat/dikonfirmasi sekali oleh orang yang sama, jadi
// menghitung dokumen = menghitung aksi.
async function aksiSejamTerakhir(userId, now) {
  const sejak = new Date(now - 60 * 60 * 1000);
  return TrafficReport.countDocuments({
    $or: [
      { user: userId, createdAt: { $gt: sejak } },
      { konfirmasiOleh: { $elemMatch: { user: userId, pada: { $gt: sejak } } } },
    ],
  });
}

// Kirim laporan: gabung ke laporan sejenis di dekatnya bila ada, selain itu buat baru.
// → { laporan, digabung }
export async function kirimLaporan(user, { lat, lng, tingkat, kejadian = 'none', catatan }, now = Date.now()) {
  if ((await aksiSejamTerakhir(user._id, now)) >= BATAS_PER_JAM) {
    throw httpError(
      429,
      `Maksimal ${BATAS_PER_JAM} laporan per jam. Coba lagi nanti ya`,
      'BATAS_LAPORAN',
    );
  }

  const titik = { type: 'Point', coordinates: [lng, lat] };
  const kandidat = await TrafficReport.find({
    lokasi: { $near: { $geometry: titik, $maxDistance: RADIUS_GABUNG_M } },
    tingkat,
    kejadian,
    updatedAt: { $gte: new Date(now - JENDELA_GABUNG_MS) },
    expiresAt: { $gt: new Date(now) },
  })
    .select('+konfirmasiOleh')
    .limit(5);

  for (const k of kandidat) {
    const sudahIkut = k.user.equals(user._id) || k.konfirmasiOleh.some((c) => c.user.equals(user._id));
    // Laporan sendiri / sudah dikonfirmasi: tidak dihitung dua kali (idempoten).
    if (sudahIkut) return { laporan: k, digabung: true };

    // Atomik: dua permintaan bersamaan dari orang yang sama tidak menambah dua kali.
    const baru = await TrafficReport.findOneAndUpdate(
      { _id: k._id, user: { $ne: user._id }, 'konfirmasiOleh.user': { $ne: user._id } },
      {
        $inc: { konfirmasi: 1 },
        $push: { konfirmasiOleh: { user: user._id, pada: new Date(now) } },
        // Dikonfirmasi = masih terjadi, umurnya diperpanjang 2 jam dari sekarang.
        $max: { expiresAt: new Date(now + TRAFFIC_TTL_MS) },
      },
      { returnDocument: 'after' },
    );
    if (baru) return { laporan: baru, digabung: true };
    return { laporan: k, digabung: true };
  }

  const laporan = await TrafficReport.create({
    user: user._id,
    lokasi: titik,
    tingkat,
    kejadian,
    catatan: catatan || undefined,
    expiresAt: new Date(now + TRAFFIC_TTL_MS),
  });
  return { laporan, digabung: false };
}
