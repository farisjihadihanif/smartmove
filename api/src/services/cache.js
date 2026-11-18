import GeoCache from '../models/GeoCache.js';

// Cache hasil layanan peta di MongoDB (TTL 15 menit lewat index GeoCache).
// `ambil()` hanya dipanggil bila kunci belum ada; hasil `undefined` tidak disimpan.
export async function denganCache(kunci, ambil) {
  const ada = await GeoCache.findOne({ kunci }).lean();
  if (ada) return ada.data;
  const data = await ambil();
  if (data !== undefined) {
    await GeoCache.updateOne(
      { kunci },
      { $setOnInsert: { kunci, data, createdAt: new Date() } },
      { upsert: true },
    ).catch((err) => {
      if (err?.code !== 11000) throw err; // permintaan bersamaan: yang lain sudah menyimpan
    });
  }
  return data;
}
